use actix_session::Session;
use actix_web::{web, HttpRequest, HttpResponse};
use serde_json::json;
use tera::Tera;

use crate::models::{FlagsMap, LoginForm, PreviewRequest};
use crate::narrative;
use crate::preview::fetch_url;
use crate::db::Database;

pub struct AppState {
    pub tera: Tera,
    pub db: Database,
    pub flags: FlagsMap,
}

// -- Helper: get logged-in username from session ------------------------------

fn get_session_user(session: &Session) -> Option<String> {
    session.get::<String>("username").ok().flatten()
}

// -- GET / -- redirect to login -----------------------------------------------

pub async fn index(session: Session) -> HttpResponse {
    if get_session_user(&session).is_some() {
        HttpResponse::Found()
            .append_header(("Location", "/dashboard"))
            .finish()
    } else {
        HttpResponse::Found()
            .append_header(("Location", "/login"))
            .finish()
    }
}

// -- GET /login ---------------------------------------------------------------

pub async fn login_page(
    data: web::Data<AppState>,
    session: Session,
) -> HttpResponse {
    if get_session_user(&session).is_some() {
        return HttpResponse::Found()
            .append_header(("Location", "/dashboard"))
            .finish();
    }

    let mut ctx = tera::Context::new();
    ctx.insert("flavour_text", narrative::LOGIN_FLAVOUR);
    ctx.insert("error", "");
    match data.tera.render("login.html", &ctx) {
        Ok(body) => HttpResponse::Ok().content_type("text/html").body(body),
        Err(e) => HttpResponse::InternalServerError().body(format!("Template error: {}", e)),
    }
}

// -- POST /login --------------------------------------------------------------

pub async fn login_submit(
    data: web::Data<AppState>,
    session: Session,
    form: web::Form<LoginForm>,
) -> HttpResponse {
    let username = form.username.trim().to_lowercase();
    let password = &form.password;

    if let Some(user) = data.db.verify_user(&username, password) {
        session.insert("username", &user).ok();
        return HttpResponse::Found()
            .append_header(("Location", "/dashboard"))
            .finish();
    }

    let mut ctx = tera::Context::new();
    ctx.insert("flavour_text", narrative::LOGIN_FLAVOUR);
    ctx.insert("error", "Invalid username or password.");
    match data.tera.render("login.html", &ctx) {
        Ok(body) => HttpResponse::Ok().content_type("text/html").body(body),
        Err(e) => HttpResponse::InternalServerError().body(format!("Template error: {}", e)),
    }
}

// -- GET /logout --------------------------------------------------------------

pub async fn logout(session: Session) -> HttpResponse {
    session.purge();
    HttpResponse::Found()
        .append_header(("Location", "/login"))
        .finish()
}

// -- GET /dashboard -----------------------------------------------------------

pub async fn dashboard(
    data: web::Data<AppState>,
    session: Session,
) -> HttpResponse {
    let username = match get_session_user(&session) {
        Some(u) => u,
        None => {
            return HttpResponse::Found()
                .append_header(("Location", "/login"))
                .finish()
        }
    };

    let mut ctx = tera::Context::new();
    ctx.insert("username", &username);

    // Build blog post data for the template
    let posts: Vec<serde_json::Value> = narrative::BLOG_POSTS
        .iter()
        .map(|p| {
            json!({
                "title": p.title,
                "author": p.author,
                "date": p.date,
                "body": p.body,
            })
        })
        .collect();
    ctx.insert("posts", &posts);

    match data.tera.render("dashboard.html", &ctx) {
        Ok(body) => HttpResponse::Ok().content_type("text/html").body(body),
        Err(e) => HttpResponse::InternalServerError().body(format!("Template error: {}", e)),
    }
}

// -- GET /preview (UI page) ---------------------------------------------------

pub async fn preview_page(
    data: web::Data<AppState>,
    session: Session,
) -> HttpResponse {
    let username = match get_session_user(&session) {
        Some(u) => u,
        None => {
            return HttpResponse::Found()
                .append_header(("Location", "/login"))
                .finish()
        }
    };

    let mut ctx = tera::Context::new();
    ctx.insert("username", &username);
    ctx.insert("result", "");
    ctx.insert("submitted_url", "");
    match data.tera.render("preview.html", &ctx) {
        Ok(body) => HttpResponse::Ok().content_type("text/html").body(body),
        Err(e) => HttpResponse::InternalServerError().body(format!("Template error: {}", e)),
    }
}

// -- POST /api/preview (SSRF-vulnerable endpoint) -----------------------------

pub async fn api_preview(
    data: web::Data<AppState>,
    session: Session,
    body: web::Json<PreviewRequest>,
) -> HttpResponse {
    let username = match get_session_user(&session) {
        Some(u) => u,
        None => {
            return HttpResponse::Unauthorized().json(json!({"error": "Authentication required"}))
        }
    };

    let url = body.url.trim();
    if url.is_empty() {
        return HttpResponse::BadRequest().json(json!({"error": "URL is required"}));
    }

    match fetch_url(url).await {
        Ok(mut response_body) => {
            // Replace flag placeholders with per-user flag values
            if let Some(user_flags) = data.flags.get(&username) {
                response_body = response_body.replace(
                    narrative::FLAG1_PLACEHOLDER,
                    &user_flags.flag1,
                );
                response_body = response_body.replace(
                    narrative::FLAG2_PLACEHOLDER,
                    &user_flags.flag2,
                );
                response_body = response_body.replace(
                    narrative::FLAG3_PLACEHOLDER,
                    &user_flags.flag3,
                );
            }
            HttpResponse::Ok()
                .content_type("text/plain")
                .body(response_body)
        }
        Err(e) => HttpResponse::BadGateway().json(json!({"error": e})),
    }
}

// -- GET /health (unauthenticated) --------------------------------------------

pub async fn health() -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "service": narrative::HEALTH_SERVICE,
        "version": narrative::HEALTH_VERSION,
        "status": "operational",
        "uptime": "running",
        "ssrf_note": narrative::HEALTH_SSRF_NOTE,
        "internal_hint": narrative::HEALTH_INTERNAL_HINT,
        "admin_route": narrative::HEALTH_ADMIN_ROUTE,
        "changelog": narrative::HEALTH_CHANGELOG,
    }))
}

// -- GET /admin (protected by X-Session-Token header only) --------------------

pub async fn admin_panel(
    data: web::Data<AppState>,
    req: HttpRequest,
    session: Session,
) -> HttpResponse {
    // Check X-Session-Token header
    let token = req
        .headers()
        .get("X-Session-Token")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    if token != narrative::ADMIN_SESSION_TOKEN {
        return HttpResponse::Forbidden().json(json!({
            "error": "Access denied. Valid session token required."
        }));
    }

    // Determine which user's flag to display from the login session
    let flag4_value = match get_session_user(&session) {
        Some(username) => data
            .flags
            .get(&username)
            .map(|f| f.flag4.clone())
            .unwrap_or_else(|| "FLAG_NOT_FOUND".to_string()),
        None => "FLAG_NOT_FOUND_NO_SESSION".to_string(),
    };

    let mut ctx = tera::Context::new();
    ctx.insert("case_file", narrative::ADMIN_CASE_FILE);
    ctx.insert("flag4", &flag4_value);
    match data.tera.render("admin.html", &ctx) {
        Ok(body) => HttpResponse::Ok().content_type("text/html").body(body),
        Err(e) => HttpResponse::InternalServerError().body(format!("Template error: {}", e)),
    }
}
