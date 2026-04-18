package handlers

import (
	"database/sql"
	"net/http"

	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"

	"github.com/greystone/pressroom/internal/middleware"
	"github.com/greystone/pressroom/internal/models"
)

// AuthDeps groups the collaborators the auth handlers need.
type AuthDeps struct {
	DB          *sql.DB
	RateLimiter *middleware.LoginRateLimiter
}

// LoginPage renders the login template.
func (d *AuthDeps) LoginPage(c *gin.Context) {
	errorKind := c.Query("error")
	c.HTML(http.StatusOK, "login.html", gin.H{
		"ErrorKind": errorKind,
		"Next":      c.Query("next"),
	})
}

// LoginSubmit verifies credentials, regenerates the session on success and
// redirects to the dashboard.
func (d *AuthDeps) LoginSubmit(c *gin.Context) {
	username := c.PostForm("username")
	password := c.PostForm("password")
	ip := c.ClientIP()

	if username == "" || password == "" {
		d.renderLoginError(c, "missing_fields")
		return
	}

	user, err := loadUser(d.DB, username)
	if err != nil {
		d.RateLimiter.Record(ip)
		d.renderLoginError(c, "invalid")
		return
	}
	if !user.Active {
		d.RateLimiter.Record(ip)
		d.renderLoginError(c, "disabled")
		return
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		d.RateLimiter.Record(ip)
		d.renderLoginError(c, "invalid")
		return
	}

	sess := sessions.Default(c)
	// Regenerate the session on login to kill any fixated session identifier.
	sess.Clear()
	_ = sess.Save()
	sess.Set(middleware.SessionUserKey, user.Username)
	if err := sess.Save(); err != nil {
		d.renderLoginError(c, "session")
		return
	}
	d.RateLimiter.Reset(ip)

	next := c.PostForm("next")
	if next == "" {
		next = "/dashboard"
	}
	c.Redirect(http.StatusFound, next)
}

// Logout clears the session and returns the player to the login page.
func (d *AuthDeps) Logout(c *gin.Context) {
	sess := sessions.Default(c)
	sess.Clear()
	_ = sess.Save()
	c.Redirect(http.StatusFound, "/login")
}

// Me returns the signed-in user's basic profile as JSON. The admin.js
// client-side guard reads this to decide whether to render the admin view.
func (d *AuthDeps) Me(c *gin.Context) {
	username := middleware.CurrentUsername(c)
	user, err := loadUser(d.DB, username)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"username":     user.Username,
		"display_name": user.DisplayName,
		"role":         user.Role,
	})
}

func (d *AuthDeps) renderLoginError(c *gin.Context, kind string) {
	c.HTML(http.StatusUnauthorized, "login.html", gin.H{
		"ErrorKind": kind,
		"Next":      c.PostForm("next"),
	})
}

func loadUser(db *sql.DB, username string) (*models.User, error) {
	row := db.QueryRow(`SELECT id, username, password_hash, display_name, role, active FROM users WHERE username = ?`, username)
	u := &models.User{}
	var active int
	if err := row.Scan(&u.ID, &u.Username, &u.PasswordHash, &u.DisplayName, &u.Role, &active); err != nil {
		return nil, err
	}
	u.Active = active != 0
	return u, nil
}
