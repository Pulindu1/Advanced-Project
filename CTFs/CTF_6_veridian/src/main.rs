mod db;
mod models;
mod narrative;
mod preview;
mod routes;

use actix_files as fs;
use actix_session::{config::PersistentSession, storage::CookieSessionStore, SessionMiddleware};
use actix_web::{cookie, web, App, HttpServer, middleware::Logger};
use std::path::Path;

use models::{CredsMap, FlagsMap};
use routes::AppState;

fn load_json_file<T: serde::de::DeserializeOwned>(path: &str) -> T {
    let content = std::fs::read_to_string(path)
        .unwrap_or_else(|e| panic!("Failed to read {}: {}", path, e));
    serde_json::from_str(&content)
        .unwrap_or_else(|e| panic!("Failed to parse {}: {}", path, e))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    env_logger::init_from_env(env_logger::Env::default().default_filter_or("info"));

    // Load per-user flags and credentials from mounted JSON files
    let flags_path = std::env::var("FLAGS_PATH").unwrap_or_else(|_| "/app/flags.json".to_string());
    let creds_path = std::env::var("CREDS_PATH").unwrap_or_else(|_| "/app/credentials.json".to_string());

    let flags: FlagsMap = load_json_file(&flags_path);
    let creds: CredsMap = load_json_file(&creds_path);

    log::info!("Loaded flags for {} users", flags.len());
    log::info!("Loaded credentials for {} users", creds.len());

    // Initialise SQLite database and seed users
    let db_path = std::env::var("DATABASE_PATH").unwrap_or_else(|_| "/app/data/veridian.db".to_string());
    if let Some(parent) = Path::new(&db_path).parent() {
        std::fs::create_dir_all(parent).ok();
    }
    let database = db::Database::new(&db_path).expect("Failed to initialise database");
    database.seed_users(&creds).expect("Failed to seed users");
    log::info!("Database initialised and users seeded");

    // Initialise Tera templates
    let template_dir = std::env::var("TEMPLATE_DIR").unwrap_or_else(|_| "/app/templates/**/*".to_string());
    let tera = tera::Tera::new(&template_dir).expect("Failed to load templates");

    let static_dir = std::env::var("STATIC_DIR").unwrap_or_else(|_| "/app/static".to_string());

    // Session encryption key
    let secret_key = cookie::Key::generate();

    let app_data = web::Data::new(AppState {
        tera,
        db: database,
        flags,
    });

    let bind_addr = std::env::var("BIND_ADDR").unwrap_or_else(|_| "0.0.0.0:8080".to_string());
    log::info!("Starting Veridian Secure Portal on {}", bind_addr);

    HttpServer::new(move || {
        App::new()
            .wrap(Logger::default())
            .wrap(
                SessionMiddleware::builder(CookieSessionStore::default(), secret_key.clone())
                    .session_lifecycle(
                        PersistentSession::default()
                            .session_ttl(cookie::time::Duration::hours(4)),
                    )
                    .cookie_http_only(true)
                    .cookie_same_site(cookie::SameSite::Lax)
                    .cookie_secure(false)
                    .build(),
            )
            .app_data(app_data.clone())
            .route("/", web::get().to(routes::index))
            .route("/login", web::get().to(routes::login_page))
            .route("/login", web::post().to(routes::login_submit))
            .route("/logout", web::get().to(routes::logout))
            .route("/dashboard", web::get().to(routes::dashboard))
            .route("/preview", web::get().to(routes::preview_page))
            .route("/api/preview", web::post().to(routes::api_preview))
            .route("/health", web::get().to(routes::health))
            .route("/admin", web::get().to(routes::admin_panel))
            .service(fs::Files::new("/static", &static_dir).show_files_listing())
    })
    .bind(&bind_addr)?
    .run()
    .await
}
