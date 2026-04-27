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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::UserCredential;
    use actix_session::storage::CookieSessionStore;
    use actix_session::SessionMiddleware;
    use actix_web::{cookie::Key, http::StatusCode, test, web, App};
    use std::collections::HashMap;

    fn build_state_empty() -> web::Data<AppState> {
        let db = Database::new(":memory:").expect("in-memory db");
        let tera = Tera::default();
        let flags: FlagsMap = HashMap::new();
        web::Data::new(AppState { tera, db, flags })
    }

    fn build_state_with_user(username: &str, password: &str) -> web::Data<AppState> {
        let db = Database::new(":memory:").expect("in-memory db");
        let mut creds: HashMap<String, UserCredential> = HashMap::new();
        creds.insert(
            username.to_string(),
            UserCredential {
                password: password.to_string(),
                role: "analyst".to_string(),
            },
        );
        db.seed_users(&creds).expect("seed users");
        let tera = Tera::default();
        let flags: FlagsMap = HashMap::new();
        web::Data::new(AppState { tera, db, flags })
    }

    #[actix_web::test]
    async fn api_preview_requires_session() {
        let key = Key::generate();
        let app = test::init_service(
            App::new()
                .wrap(SessionMiddleware::new(CookieSessionStore::default(), key.clone()))
                .app_data(build_state_empty())
                .route("/api/preview", web::post().to(api_preview)),
        )
        .await;
        let req = test::TestRequest::post()
            .uri("/api/preview")
            .set_json(serde_json::json!({ "url": "http://example.com" }))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
    }

    #[actix_web::test]
    async fn admin_panel_rejects_missing_session_token() {
        let key = Key::generate();
        let app = test::init_service(
            App::new()
                .wrap(SessionMiddleware::new(CookieSessionStore::default(), key.clone()))
                .app_data(build_state_empty())
                .route("/admin", web::get().to(admin_panel)),
        )
        .await;
        let req = test::TestRequest::get().uri("/admin").to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), StatusCode::FORBIDDEN);
    }

    #[actix_web::test]
    async fn admin_panel_rejects_wrong_session_token() {
        let key = Key::generate();
        let app = test::init_service(
            App::new()
                .wrap(SessionMiddleware::new(CookieSessionStore::default(), key.clone()))
                .app_data(build_state_empty())
                .route("/admin", web::get().to(admin_panel)),
        )
        .await;
        let req = test::TestRequest::get()
            .uri("/admin")
            .insert_header(("X-Session-Token", "definitely-not-the-real-one"))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), StatusCode::FORBIDDEN);
    }

    #[actix_web::test]
    async fn index_redirects_to_login_when_anonymous() {
        let key = Key::generate();
        let app = test::init_service(
            App::new()
                .wrap(SessionMiddleware::new(CookieSessionStore::default(), key.clone()))
                .app_data(build_state_empty())
                .route("/", web::get().to(index)),
        )
        .await;
        let req = test::TestRequest::get().uri("/").to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), StatusCode::FOUND);
        let location = resp
            .headers()
            .get("Location")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("");
        assert_eq!(location, "/login");
    }

    #[actix_web::test]
    async fn dashboard_redirects_to_login_when_anonymous() {
        let key = Key::generate();
        let app = test::init_service(
            App::new()
                .wrap(SessionMiddleware::new(CookieSessionStore::default(), key.clone()))
                .app_data(build_state_empty())
                .route("/dashboard", web::get().to(dashboard)),
        )
        .await;
        let req = test::TestRequest::get().uri("/dashboard").to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), StatusCode::FOUND);
        let location = resp
            .headers()
            .get("Location")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("");
        assert_eq!(location, "/login");
    }

    #[actix_web::test]
    async fn preview_page_redirects_to_login_when_anonymous() {
        let key = Key::generate();
        let app = test::init_service(
            App::new()
                .wrap(SessionMiddleware::new(CookieSessionStore::default(), key.clone()))
                .app_data(build_state_empty())
                .route("/preview", web::get().to(preview_page)),
        )
        .await;
        let req = test::TestRequest::get().uri("/preview").to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), StatusCode::FOUND);
        let location = resp
            .headers()
            .get("Location")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("");
        assert_eq!(location, "/login");
    }

    #[actix_web::test]
    async fn logout_redirects_to_login() {
        let key = Key::generate();
        let app = test::init_service(
            App::new()
                .wrap(SessionMiddleware::new(CookieSessionStore::default(), key.clone()))
                .app_data(build_state_empty())
                .route("/logout", web::get().to(logout)),
        )
        .await;
        let req = test::TestRequest::get().uri("/logout").to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), StatusCode::FOUND);
        let location = resp
            .headers()
            .get("Location")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("");
        assert_eq!(location, "/login");
    }

    #[actix_web::test]
    async fn health_returns_json_payload_unauthenticated() {
        let key = Key::generate();
        let app = test::init_service(
            App::new()
                .wrap(SessionMiddleware::new(CookieSessionStore::default(), key.clone()))
                .app_data(build_state_empty())
                .route("/health", web::get().to(health)),
        )
        .await;
        let req = test::TestRequest::get().uri("/health").to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), StatusCode::OK);
        let body = test::read_body(resp).await;
        let parsed: serde_json::Value =
            serde_json::from_slice(&body).expect("health response is JSON");
        assert_eq!(parsed["status"], "operational");
        assert!(parsed.get("service").is_some());
        assert!(parsed.get("version").is_some());
    }

    #[actix_web::test]
    async fn login_submit_with_valid_credentials_redirects_to_dashboard() {
        let key = Key::generate();
        let app = test::init_service(
            App::new()
                .wrap(SessionMiddleware::new(CookieSessionStore::default(), key.clone()))
                .app_data(build_state_with_user("abcd12", "passw0rd"))
                .route("/login", web::post().to(login_submit)),
        )
        .await;
        let req = test::TestRequest::post()
            .uri("/login")
            .set_form(&serde_json::json!({
                "username": "abcd12",
                "password": "passw0rd",
            }))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), StatusCode::FOUND);
        let location = resp
            .headers()
            .get("Location")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("");
        assert_eq!(location, "/dashboard");
    }
}

// Phase 2 integration tests: multi-route flows where the session
// cookie minted by /login carries through to a subsequent route call
// in the same in-process App. State -- the cookie-session payload --
// is real persistence, observable across routes.
#[cfg(test)]
mod integration {
    use super::*;
    use crate::models::{UserCredential, UserFlags};
    use actix_session::storage::CookieSessionStore;
    use actix_session::SessionMiddleware;
    use actix_web::{
        cookie::Key,
        dev::ServiceResponse,
        http::{header, StatusCode},
        test, web, App,
    };
    use std::collections::HashMap;

    fn login_template() -> &'static str {
        "<html><body>{{ flavour_text }}{{ error }}</body></html>"
    }

    fn dashboard_template() -> &'static str {
        "<html><body>welcome {{ username }}</body></html>"
    }

    fn admin_template() -> &'static str {
        "<html><body>{{ case_file }} flag={{ flag4 }}</body></html>"
    }

    fn build_state(
        creds: HashMap<String, UserCredential>,
        flags: FlagsMap,
    ) -> web::Data<AppState> {
        let db = Database::new(":memory:").expect("in-memory db");
        db.seed_users(&creds).expect("seed users");
        let mut tera = Tera::default();
        tera.add_raw_template("login.html", login_template()).unwrap();
        tera.add_raw_template("dashboard.html", dashboard_template()).unwrap();
        tera.add_raw_template("admin.html", admin_template()).unwrap();
        web::Data::new(AppState { tera, db, flags })
    }

    fn extract_session_cookie(resp: &ServiceResponse) -> Option<String> {
        resp.response()
            .cookies()
            .find(|c| c.name() == "id")
            .map(|c| format!("{}={}", c.name(), c.value()))
    }

    #[actix_web::test]
    async fn login_then_dashboard_renders_for_authenticated_user() {
        let key = Key::generate();
        let mut creds: HashMap<String, UserCredential> = HashMap::new();
        creds.insert(
            "abcd12".to_string(),
            UserCredential { password: "passw0rd".into(), role: "analyst".into() },
        );
        let app = test::init_service(
            App::new()
                .wrap(SessionMiddleware::new(CookieSessionStore::default(), key.clone()))
                .app_data(build_state(creds, HashMap::new()))
                .route("/login", web::post().to(login_submit))
                .route("/dashboard", web::get().to(dashboard)),
        )
        .await;

        let login_req = test::TestRequest::post()
            .uri("/login")
            .set_form(&serde_json::json!({"username": "abcd12", "password": "passw0rd"}))
            .to_request();
        let login_resp = test::call_service(&app, login_req).await;
        assert_eq!(login_resp.status(), StatusCode::FOUND);
        let cookie = extract_session_cookie(&login_resp)
            .expect("login_submit must set the actix-session cookie");

        let dash_req = test::TestRequest::get()
            .uri("/dashboard")
            .insert_header((header::COOKIE, cookie.clone()))
            .to_request();
        let dash_resp = test::call_service(&app, dash_req).await;
        assert_eq!(dash_resp.status(), StatusCode::OK);
        let body = test::read_body(dash_resp).await;
        let body_str = std::str::from_utf8(&body).unwrap();
        assert!(body_str.contains("welcome abcd12"),
            "dashboard should render the username from the session: got {body_str}");
    }

    #[actix_web::test]
    async fn login_then_logout_then_dashboard_redirects_back_to_login() {
        let key = Key::generate();
        let mut creds: HashMap<String, UserCredential> = HashMap::new();
        creds.insert(
            "abcd12".to_string(),
            UserCredential { password: "passw0rd".into(), role: "analyst".into() },
        );
        let app = test::init_service(
            App::new()
                .wrap(SessionMiddleware::new(CookieSessionStore::default(), key.clone()))
                .app_data(build_state(creds, HashMap::new()))
                .route("/login", web::post().to(login_submit))
                .route("/logout", web::get().to(logout))
                .route("/dashboard", web::get().to(dashboard)),
        )
        .await;

        let login_resp = test::call_service(
            &app,
            test::TestRequest::post()
                .uri("/login")
                .set_form(&serde_json::json!({"username": "abcd12", "password": "passw0rd"}))
                .to_request(),
        )
        .await;
        let cookie = extract_session_cookie(&login_resp).expect("session cookie");

        let logout_resp = test::call_service(
            &app,
            test::TestRequest::get()
                .uri("/logout")
                .insert_header((header::COOKIE, cookie.clone()))
                .to_request(),
        )
        .await;
        assert_eq!(logout_resp.status(), StatusCode::FOUND);
        let purged = extract_session_cookie(&logout_resp)
            .expect("logout should issue a cookie that purges the session");

        let dash_resp = test::call_service(
            &app,
            test::TestRequest::get()
                .uri("/dashboard")
                .insert_header((header::COOKIE, purged))
                .to_request(),
        )
        .await;
        assert_eq!(dash_resp.status(), StatusCode::FOUND);
        let location = dash_resp
            .headers()
            .get("Location")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("");
        assert_eq!(location, "/login");
    }

    #[actix_web::test]
    async fn login_then_admin_with_valid_token_returns_session_users_flag4() {
        let key = Key::generate();
        let mut creds: HashMap<String, UserCredential> = HashMap::new();
        creds.insert(
            "abcd12".to_string(),
            UserCredential { password: "passw0rd".into(), role: "analyst".into() },
        );
        let mut flags: FlagsMap = HashMap::new();
        flags.insert(
            "abcd12".to_string(),
            UserFlags {
                flag1: "f1".into(),
                flag2: "f2".into(),
                flag3: "f3".into(),
                flag4: "durham{int-flag4-abcd12}".into(),
            },
        );
        let app = test::init_service(
            App::new()
                .wrap(SessionMiddleware::new(CookieSessionStore::default(), key.clone()))
                .app_data(build_state(creds, flags))
                .route("/login", web::post().to(login_submit))
                .route("/admin", web::get().to(admin_panel)),
        )
        .await;

        let login_resp = test::call_service(
            &app,
            test::TestRequest::post()
                .uri("/login")
                .set_form(&serde_json::json!({"username": "abcd12", "password": "passw0rd"}))
                .to_request(),
        )
        .await;
        let cookie = extract_session_cookie(&login_resp).expect("session cookie");

        let admin_resp = test::call_service(
            &app,
            test::TestRequest::get()
                .uri("/admin")
                .insert_header((header::COOKIE, cookie))
                .insert_header(("X-Session-Token", narrative::ADMIN_SESSION_TOKEN))
                .to_request(),
        )
        .await;
        assert_eq!(admin_resp.status(), StatusCode::OK);
        let body = test::read_body(admin_resp).await;
        let body_str = std::str::from_utf8(&body).unwrap();
        assert!(
            body_str.contains("durham{int-flag4-abcd12}"),
            "admin page must look up flag4 by the session-bound username: got {body_str}"
        );
    }
}

