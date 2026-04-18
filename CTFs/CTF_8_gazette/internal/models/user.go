package models

// User models a row from the users table. Password hashes are always bcrypt.
type User struct {
	ID           int64  `json:"id"`
	Username     string `json:"username"`
	PasswordHash string `json:"-"`
	DisplayName  string `json:"display_name"`
	Role         string `json:"role"`
	Active       bool   `json:"active"`
}
