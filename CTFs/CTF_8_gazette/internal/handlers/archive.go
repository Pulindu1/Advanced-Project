package handlers

import (
	"database/sql"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/greystone/pressroom/internal/middleware"
	"github.com/greystone/pressroom/internal/models"
)

// ArchiveDeps groups the collaborators the archive handlers need.
type ArchiveDeps struct {
	DB *sql.DB
}

// ArchivePage renders the /archive HTML listing. The list shows every
// published article plus the signed-in user's own articles regardless of
// status. Drafts belonging to other users (including article 3, the Flag 1
// target) are deliberately excluded so the player has to enumerate IDs to
// find them.
func (d *ArchiveDeps) ArchivePage(c *gin.Context) {
	username := middleware.CurrentUsername(c)
	user, err := loadUser(d.DB, username)
	if err != nil {
		c.HTML(http.StatusInternalServerError, "error.html", gin.H{
			"Title":   "PressRoom: Archive unavailable",
			"Message": "Your profile could not be loaded.",
		})
		return
	}
	articles, err := listArchiveArticles(d.DB, user.ID)
	if err != nil {
		c.HTML(http.StatusInternalServerError, "error.html", gin.H{
			"Title":   "PressRoom: Archive unavailable",
			"Message": "The archive listing is currently unavailable.",
		})
		return
	}
	c.HTML(http.StatusOK, "archive.html", gin.H{
		"User":     user,
		"Articles": articles,
	})
}

// APIArchive returns the same listing as JSON for parity with the rest of
// the API. No ownership-bypass risk here: the query filters server-side to
// published-or-own, so the endpoint never leaks foreign drafts.
func (d *ArchiveDeps) APIArchive(c *gin.Context) {
	username := middleware.CurrentUsername(c)
	user, err := loadUser(d.DB, username)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "user lookup failed"})
		return
	}
	articles, err := listArchiveArticles(d.DB, user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "archive unavailable"})
		return
	}
	c.JSON(http.StatusOK, articles)
}

func listArchiveArticles(db *sql.DB, viewerID int64) ([]models.Article, error) {
	rows, err := db.Query(`
SELECT a.id, a.title, a.body, a.author_id, u.display_name, a.status, a.category, a.created_at
FROM articles a
JOIN users u ON u.id = a.author_id
WHERE a.status = 'published' OR a.author_id = ?
ORDER BY a.id ASC
`, viewerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanArticles(rows)
}
