package models

// Article models a row from the articles table.
type Article struct {
	ID         int64  `json:"id"`
	Title      string `json:"title"`
	Body       string `json:"body"`
	AuthorID   int64  `json:"author_id"`
	AuthorName string `json:"author_name"`
	Status     string `json:"status"`
	Category   string `json:"category"`
	CreatedAt  string `json:"created_at"`
}
