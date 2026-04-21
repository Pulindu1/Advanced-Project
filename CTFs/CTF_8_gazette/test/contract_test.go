package test

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

// TestLoginWrongPasswordReturns401 verifies the authentication boundary:
// a correctly-formed login with the wrong password must be rejected.
func TestLoginWrongPasswordReturns401(t *testing.T) {
	r, _ := newTestServer(t)
	form := url.Values{"username": {"abcd12"}, "password": {"wrong-password"}}
	req := httptest.NewRequest(http.MethodPost, "/login", strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for wrong password, got %d: %s", w.Code, w.Body.String())
	}
}

// TestLoginUnknownUserReturns401 verifies the server returns a uniform 401
// for unknown usernames (no user-enumeration differential).
func TestLoginUnknownUserReturns401(t *testing.T) {
	r, _ := newTestServer(t)
	form := url.Values{"username": {"nobody_exists_zz99"}, "password": {"anything"}}
	req := httptest.NewRequest(http.MethodPost, "/login", strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for unknown user, got %d: %s", w.Code, w.Body.String())
	}
}

// TestAPIMeRequiresSession verifies /api/me is session-gated.
func TestAPIMeRequiresSession(t *testing.T) {
	r, _ := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/me", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 without session, got %d", w.Code)
	}
}
