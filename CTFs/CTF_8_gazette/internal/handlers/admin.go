package handlers

import (
	"database/sql"
	"net/http"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/greystone/pressroom/internal/middleware"
	"github.com/greystone/pressroom/internal/services"
)

// AdminDeps groups the collaborators the admin routes need.
type AdminDeps struct {
	DB    *sql.DB
	Flags *services.FlagStore
}

// AdminPage renders the shell of the admin dashboard. The real authorisation
// check is missing: it is intentionally done in JavaScript only (see
// static/js/admin.js and the admin template). That lets a player who bypasses
// the client-side redirect reach /api/admin/dashboard directly.
func (d *AdminDeps) AdminPage(c *gin.Context) {
	c.HTML(http.StatusOK, "admin.html", gin.H{
		"User": gin.H{"Username": middleware.CurrentUsername(c)},
	})
}

// APIDashboard returns the full admin dashboard payload. There is no
// server-side role enforcement (OWASP A01:2021). Any authenticated user
// can read Flag 2 by calling this endpoint directly.
func (d *AdminDeps) APIDashboard(c *gin.Context) {
	username := middleware.CurrentUsername(c)

	users, err := listAllUsers(d.DB)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "user directory unavailable"})
		return
	}
	articleCount, err := countArticles(d.DB)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "article stats unavailable"})
		return
	}

	flag2 := "durham-gzflag2{audit_account_not_issued}"
	if fs, ok := d.Flags.Get(username); ok {
		flag2 = fs.Flag2
	}

	c.JSON(http.StatusOK, gin.H{
		"flag": flag2,
		"system": gin.H{
			"app":             "PressRoom",
			"version":         "3.2.1",
			"build":           "pressroom-3.2.1-maintenance",
			"digital_since":   "2023-09",
			"editor_in_chief": "sarah.lin",
			"notes":           "Editor-in-chief only. If you can read this in a browser and you are not Sarah, report it immediately.",
		},
		"stats": gin.H{
			"users_total":       len(users),
			"articles_total":    articleCount,
			"drafts_in_flight":  countArticlesByStatus(d.DB, "draft"),
			"published_this_wk": 4,
		},
		"users": users,
		"maintenance_tools": []gin.H{
			{
				"name":     "Network Diagnostics",
				"endpoint": "/api/admin/health",
				"method":   "POST",
				"body":     `{"host": "example.com"}`,
				"added_by": "marcus.webb",
				"note":     "Quick ping utility for checking if upstream services are reachable. Added a filter after the incident in March. -- M.W.",
			},
			{
				"name":     "Style Guide Lint",
				"endpoint": "/api/admin/lint",
				"method":   "POST",
				"body":     `{"article_id": 0}`,
				"added_by": "sarah.lin",
				"note":     "Stub. Will be wired up after the backlog review.",
			},
		},
	})
}

// APIHealth runs the vulnerable ping utility. The admin role is NOT enforced
// server-side so this endpoint is reachable by any authenticated user. The
// Flag 3 exploit reaches this handler by calling it with a normal session
// cookie.
func (d *AdminDeps) APIHealth(c *gin.Context) {
	var body struct {
		Host string `json:"host"`
	}
	if err := c.BindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON body"})
		return
	}
	host := strings.TrimSpace(body.Host)
	if host == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "host is required"})
		return
	}
	res := services.PingHost(host)
	status := http.StatusOK
	if res.Error != "" && strings.HasPrefix(res.Error, "Invalid host") {
		status = http.StatusBadRequest
	}
	c.JSON(status, res)
}

// APILint is the stub referenced in the maintenance tools list. It does
// nothing interesting; its role is narrative (confirms "this is the second
// tool, there will be more" so the ping endpoint feels like a real feature).
func (d *AdminDeps) APILint(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status": "ok",
		"note":   "Linter not wired up. See Sarah before enabling.",
	})
}

// FlagsDir is used by the solutions and runtime to confirm flag file paths.
func (d *AdminDeps) FlagsDir() string {
	return filepath.Clean(d.Flags.FlagsDir())
}

type adminUserRow struct {
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
	Role        string `json:"role"`
	Active      bool   `json:"active"`
}

func listAllUsers(db *sql.DB) ([]adminUserRow, error) {
	rows, err := db.Query(`SELECT username, display_name, role, active FROM users ORDER BY id ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []adminUserRow
	for rows.Next() {
		var u adminUserRow
		var active int
		if err := rows.Scan(&u.Username, &u.DisplayName, &u.Role, &active); err != nil {
			return nil, err
		}
		u.Active = active != 0
		out = append(out, u)
	}
	return out, rows.Err()
}

func countArticles(db *sql.DB) (int, error) {
	var n int
	if err := db.QueryRow(`SELECT COUNT(*) FROM articles`).Scan(&n); err != nil {
		return 0, err
	}
	return n, nil
}

func countArticlesByStatus(db *sql.DB, status string) int {
	var n int
	if err := db.QueryRow(`SELECT COUNT(*) FROM articles WHERE status = ?`, status).Scan(&n); err != nil {
		return 0
	}
	return n
}
