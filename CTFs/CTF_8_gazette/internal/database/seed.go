package database

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"os"

	"golang.org/x/crypto/bcrypt"
)

type userSeed struct {
	Password    string `json:"password"`
	DisplayName string `json:"display_name"`
	Role        string `json:"role"`
	Active      bool   `json:"active"`
	Description string `json:"description"`
}

type articleSeed struct {
	ID       int64  `json:"id"`
	Title    string `json:"title"`
	Author   string `json:"author"`
	Status   string `json:"status"`
	Category string `json:"category"`
	Body     string `json:"body"`
}

// Seed loads users.json, articles.json, and (optionally) contributor-articles.json
// from dataDir and upserts them into the database. Existing rows with the same
// username or id are overwritten so that the seed is idempotent across restarts.
// contributor-articles.json is emitted by chgen_ctf8.js and carries one
// onboarding draft per player; if the file is missing the seed still succeeds
// (useful for tests that run without the generator step).
func Seed(db *sql.DB, dataDir string) error {
	usersPath := fmt.Sprintf("%s/users.json", dataDir)
	articlesPath := fmt.Sprintf("%s/articles.json", dataDir)
	contribPath := fmt.Sprintf("%s/contributor-articles.json", dataDir)

	userMap, err := loadUsers(usersPath)
	if err != nil {
		return fmt.Errorf("load users: %w", err)
	}
	articles, err := loadArticles(articlesPath)
	if err != nil {
		return fmt.Errorf("load articles: %w", err)
	}
	contribArticles, err := loadArticlesOptional(contribPath)
	if err != nil {
		return fmt.Errorf("load contributor articles: %w", err)
	}

	if err := seedUsers(db, userMap); err != nil {
		return err
	}
	if err := seedArticles(db, articles); err != nil {
		return err
	}
	if err := seedArticles(db, contribArticles); err != nil {
		return err
	}
	log.Printf("seed: loaded %d users, %d staff articles, %d contributor articles",
		len(userMap), len(articles), len(contribArticles))
	return nil
}

func loadUsers(path string) (map[string]userSeed, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	out := map[string]userSeed{}
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil, err
	}
	return out, nil
}

func loadArticles(path string) ([]articleSeed, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var out []articleSeed
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil, err
	}
	return out, nil
}

func loadArticlesOptional(path string) ([]articleSeed, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}
	var out []articleSeed
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil, err
	}
	return out, nil
}

func seedUsers(db *sql.DB, users map[string]userSeed) error {
	for username, u := range users {
		hash, err := bcrypt.GenerateFromPassword([]byte(u.Password), bcrypt.DefaultCost)
		if err != nil {
			return fmt.Errorf("hash password for %s: %w", username, err)
		}
		active := 0
		if u.Active {
			active = 1
		}
		_, err = db.Exec(`
INSERT INTO users (username, password_hash, display_name, role, active)
VALUES (?, ?, ?, ?, ?)
ON CONFLICT(username) DO UPDATE SET
  password_hash = excluded.password_hash,
  display_name = excluded.display_name,
  role = excluded.role,
  active = excluded.active
`, username, string(hash), u.DisplayName, u.Role, active)
		if err != nil {
			return fmt.Errorf("upsert user %s: %w", username, err)
		}
	}
	return nil
}

func seedArticles(db *sql.DB, articles []articleSeed) error {
	for _, a := range articles {
		var authorID int64
		if err := db.QueryRow(`SELECT id FROM users WHERE username = ?`, a.Author).Scan(&authorID); err != nil {
			return fmt.Errorf("lookup author %s for article %d: %w", a.Author, a.ID, err)
		}
		_, err := db.Exec(`
INSERT INTO articles (id, title, body, author_id, status, category)
VALUES (?, ?, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
  title = excluded.title,
  body = excluded.body,
  author_id = excluded.author_id,
  status = excluded.status,
  category = excluded.category
`, a.ID, a.Title, a.Body, authorID, a.Status, a.Category)
		if err != nil {
			return fmt.Errorf("upsert article %d: %w", a.ID, err)
		}
	}
	return nil
}
