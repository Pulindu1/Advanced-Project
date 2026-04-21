use rusqlite::{Connection, Result as SqlResult};
use std::sync::Mutex;

use crate::models::CredsMap;

pub struct Database {
    pub conn: Mutex<Connection>,
}

impl Database {
    pub fn new(path: &str) -> SqlResult<Self> {
        let conn = Connection::open(path)?;
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'analyst'
            );",
        )?;
        Ok(Database {
            conn: Mutex::new(conn),
        })
    }

    pub fn seed_users(&self, creds: &CredsMap) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "INSERT OR REPLACE INTO users (username, password, role) VALUES (?1, ?2, ?3)",
        )?;
        for (username, cred) in creds {
            stmt.execute(rusqlite::params![username, cred.password, cred.role])?;
        }
        Ok(())
    }

    pub fn verify_user(&self, username: &str, password: &str) -> Option<String> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare("SELECT username FROM users WHERE username = ?1 AND password = ?2")
            .ok()?;
        stmt.query_row(rusqlite::params![username, password], |row| {
            row.get::<_, String>(0)
        })
        .ok()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::UserCredential;
    use std::collections::HashMap;

    fn build_creds() -> CredsMap {
        let mut creds: CredsMap = HashMap::new();
        creds.insert(
            "abcd12".to_string(),
            UserCredential {
                password: "passw0rd".to_string(),
                role: "analyst".to_string(),
            },
        );
        creds
    }

    #[test]
    fn seed_and_verify_accepts_correct_credentials() {
        let db = Database::new(":memory:").unwrap();
        db.seed_users(&build_creds()).unwrap();
        assert_eq!(db.verify_user("abcd12", "passw0rd"), Some("abcd12".into()));
    }

    #[test]
    fn verify_rejects_wrong_password() {
        let db = Database::new(":memory:").unwrap();
        db.seed_users(&build_creds()).unwrap();
        assert!(db.verify_user("abcd12", "wrong").is_none());
    }

    #[test]
    fn seed_is_idempotent_on_duplicate_username() {
        let db = Database::new(":memory:").unwrap();
        db.seed_users(&build_creds()).unwrap();
        db.seed_users(&build_creds()).unwrap();
        assert_eq!(db.verify_user("abcd12", "passw0rd"), Some("abcd12".into()));
    }
}
