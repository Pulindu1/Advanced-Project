package handlers

import (
	"database/sql"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/greystone/pressroom/internal/middleware"
	"github.com/greystone/pressroom/internal/models"
	"github.com/greystone/pressroom/internal/services"
)

// ArticleDeps groups the collaborators the article handlers need.
type ArticleDeps struct {
	DB    *sql.DB
	Flags *services.FlagStore
}

// ArticlePage renders a single article as HTML. It fetches through the same
// vulnerable lookup as the JSON endpoint so that the browser view mirrors
// what the API exposes.
func (d *ArticleDeps) ArticlePage(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.HTML(http.StatusBadRequest, "error.html", gin.H{
			"Title":   "PressRoom: Invalid article id",
			"Message": "Article identifiers are numeric.",
		})
		return
	}
	article, err := d.lookupArticle(id)
	if err != nil {
		c.HTML(http.StatusNotFound, "error.html", gin.H{
			"Title":   "PressRoom: Article not found",
			"Message": "No article with that identifier exists in the archive.",
		})
		return
	}
	viewer := middleware.CurrentUsername(c)
	article.Body = d.substituteTokens(article.Body, viewer)
	c.HTML(http.StatusOK, "article.html", gin.H{
		"User":    gin.H{"Username": viewer},
		"Article": article,
	})
}

// APIGetArticle is the JSON endpoint the dashboard calls when a reader
// clicks an article. It INTENTIONALLY performs no ownership check, so any
// authenticated user can read any article id. This is Flag 1.
func (d *ArticleDeps) APIGetArticle(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid article id"})
		return
	}
	// DELIBERATELY VULNERABLE (OWASP A01:2021): no ownership check is
	// performed. The handler returns the requested row even if the author
	// is not the signed-in user.
	article, err := d.lookupArticle(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "article not found"})
		return
	}
	viewer := middleware.CurrentUsername(c)
	article.Body = d.substituteTokens(article.Body, viewer)
	c.JSON(http.StatusOK, article)
}

// APIListOwnArticles returns the signed-in user's own articles. This route
// is deliberately well-behaved: it filters by session username. The IDOR
// lives at APIGetArticle.
func (d *ArticleDeps) APIListOwnArticles(c *gin.Context) {
	username := middleware.CurrentUsername(c)
	user, err := loadUser(d.DB, username)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "user lookup failed"})
		return
	}
	articles, err := listArticlesByAuthor(d.DB, user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "articles unavailable"})
		return
	}
	for i := range articles {
		articles[i].Body = d.substituteTokens(articles[i].Body, username)
	}
	c.JSON(http.StatusOK, articles)
}

func (d *ArticleDeps) lookupArticle(id int64) (*models.Article, error) {
	row := d.DB.QueryRow(`
SELECT a.id, a.title, a.body, a.author_id, u.display_name, a.status, a.category, a.created_at
FROM articles a
JOIN users u ON u.id = a.author_id
WHERE a.id = ?
`, id)
	var a models.Article
	var category sql.NullString
	if err := row.Scan(&a.ID, &a.Title, &a.Body, &a.AuthorID, &a.AuthorName, &a.Status, &category, &a.CreatedAt); err != nil {
		return nil, err
	}
	if category.Valid {
		a.Category = category.String
	}
	return &a, nil
}

// substituteTokens replaces narrative placeholders inside an article body
// with per-viewer flag values. This lets the IDOR deliver each player
// their own Flag 1 while the same seeded article serves every reader.
func (d *ArticleDeps) substituteTokens(body, viewer string) string {
	if !strings.Contains(body, "{{PLAYER_FLAG1}}") {
		return body
	}
	flag := ""
	if viewer != "" {
		if fs, ok := d.Flags.Get(viewer); ok {
			flag = fs.Flag1
		}
	}
	if flag == "" {
		flag = "durham-gzflag1{audit_account_not_issued}"
	}
	return strings.ReplaceAll(body, "{{PLAYER_FLAG1}}", flag)
}
