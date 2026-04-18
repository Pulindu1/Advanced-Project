package handlers

import (
	"database/sql"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/greystone/pressroom/internal/middleware"
	"github.com/greystone/pressroom/internal/models"
)

// DashboardDeps groups collaborators for the dashboard and article handlers.
type DashboardDeps struct {
	DB *sql.DB
}

// Index renders the post-login dashboard. It lists the articles owned by
// the signed-in user plus a newsroom sidebar with fictional recent headlines.
func (d *DashboardDeps) Index(c *gin.Context) {
	username := middleware.CurrentUsername(c)
	errorKind := c.Query("error")

	user, err := loadUser(d.DB, username)
	if err != nil {
		c.HTML(http.StatusInternalServerError, "error.html", gin.H{
			"Title":   "PressRoom: Something went wrong",
			"Message": "We could not load your profile. Please sign in again.",
		})
		return
	}

	articles, err := listArticlesByAuthor(d.DB, user.ID)
	if err != nil {
		c.HTML(http.StatusInternalServerError, "error.html", gin.H{
			"Title":   "PressRoom: Newsroom unavailable",
			"Message": "The articles index is currently unavailable.",
		})
		return
	}

	c.HTML(http.StatusOK, "dashboard.html", gin.H{
		"User":      user,
		"Articles":  articles,
		"ErrorKind": errorKind,
	})
}

func listArticlesByAuthor(db *sql.DB, authorID int64) ([]models.Article, error) {
	rows, err := db.Query(`
SELECT a.id, a.title, a.body, a.author_id, u.display_name, a.status, a.category, a.created_at
FROM articles a
JOIN users u ON u.id = a.author_id
WHERE a.author_id = ?
ORDER BY a.id ASC
`, authorID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanArticles(rows)
}

func scanArticles(rows *sql.Rows) ([]models.Article, error) {
	var out []models.Article
	for rows.Next() {
		var a models.Article
		var category sql.NullString
		if err := rows.Scan(&a.ID, &a.Title, &a.Body, &a.AuthorID, &a.AuthorName, &a.Status, &category, &a.CreatedAt); err != nil {
			return nil, err
		}
		if category.Valid {
			a.Category = category.String
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

