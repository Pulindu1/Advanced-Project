// ============================================================================
// Narrative constants for Veridian Secure CTF
//
// All story text is collected here. Change any of these strings to modify
// the narrative without affecting exploit logic. See workflow.md Section 18
// for which strings are safe to modify and which are not.
// ============================================================================

// -- Login page flavour text --------------------------------------------------

pub const LOGIN_FLAVOUR: &str = r#"VERIDIAN SECURE -- Internal Operations Portal

Authorised personnel only. All access is logged and monitored.
Veridian Secure is a Durham-based private security and surveillance consultancy
providing threat assessment, executive protection, and intelligence analysis
services to corporate and government clients since 2011.

If you have received access credentials from your department head,
enter them below to proceed."#;

// -- HTML source comments (embedded in templates, duplicated here for reference)

pub const HTML_COMMENT_LOGIN: &str =
    "<!-- Veridian Secure Portal v3.2.1 | Deployment: cloud-internal -->\n<!-- service status: /health -->";
pub const HTML_COMMENT_DASHBOARD: &str =
    "<!-- dashboard v3 | link preview tool available at /preview -->";
pub const HTML_COMMENT_PREVIEW: &str =
    "<!-- fetch endpoint: /api/preview -- no validation implemented yet, see issue #47 -->\n<!-- preview accepts JSON body: {\"url\": \"https://example.com\"} -->";

// -- Health endpoint fields ---------------------------------------------------
// Do NOT remove ssrf_note, internal_hint, admin_route, or changelog.

pub const HEALTH_SERVICE: &str = "Veridian Secure Portal";
pub const HEALTH_VERSION: &str = "3.2.1";
pub const HEALTH_SSRF_NOTE: &str = "preview fetches are server-side, no allowlist configured";
pub const HEALTH_INTERNAL_HINT: &str = "cloud metadata available at standard endpoint";
pub const HEALTH_ADMIN_ROUTE: &str = "/admin";
pub const HEALTH_CHANGELOG: &str = "/static/CHANGELOG.md";

// -- Blog posts (visible after login on /dashboard) ---------------------------

pub struct BlogPost {
    pub title: &'static str,
    pub author: &'static str,
    pub date: &'static str,
    pub body: &'static str,
}

pub const BLOG_POSTS: &[BlogPost] = &[
    BlogPost {
        title: "Infrastructure Migration Notes",
        author: "J. Harding, Systems Lead",
        date: "2024-02-10",
        body: r#"We have completed the migration to a cloud-hosted environment. All services
are now running on managed infrastructure. Note that during the transition
period, cloud metadata endpoints were left accessible from the application
tier for provisioning purposes. This will be locked down in Q3 once the
new IAM policy framework is approved.

For now, standard cloud metadata is reachable from any container on the
internal network."#,
    },
    BlogPost {
        title: "Tech Debt Register",
        author: "M. Torres, Engineering",
        date: "2024-03-01",
        body: r#"Current open items:

1. The link preview tool uses an HTTP client library that supports
   multiple URL schemes including dict:// and gopher://. We inherited
   this from the upstream dependency and have not yet restricted it to
   http/https only. Ticket VSEC-1134 tracks this.

2. Redis session store has no authentication configured. This was
   acceptable during development but needs to be addressed before the
   external audit in Q4.

3. The /admin dashboard checks only for a session token header.
   Full RBAC integration is deferred to the next sprint."#,
    },
    BlogPost {
        title: "Access Control Audit",
        author: "D. Chen, Security",
        date: "2024-03-10",
        body: r#"Preliminary findings from the internal access control review:

- Admin sessions are cached in the internal store for performance.
  Session tokens are passed as the X-Session-Token header.
- The current implementation does not validate token provenance.
  Any valid token string grants access.
- Recommendation: integrate with the central IAM service before
  the external audit deadline.

Status: DEFERRED (awaiting budget approval)"#,
    },
    BlogPost {
        title: "Notice: Analyst K. Marsh",
        author: "HR Department",
        date: "2024-03-16",
        body: r#"It is with regret that we inform staff of the passing of senior
analyst Kieran Marsh on 15 March 2024. The official determination
is suicide. Counselling services are available through the
employee assistance programme.

All of Kieran's case files have been archived by the executive team.
Access requests should be directed to the COO's office."#,
    },
];

// -- Admin dashboard case file ------------------------------------------------

pub const ADMIN_CASE_FILE: &str = r#"CLASSIFIED -- INCIDENT REPORT 2024-03-15

Subject: Death of Senior Analyst Kieran Marsh

Summary:
On 15 March 2024, senior analyst Kieran Marsh was found dead at his
residence. The official verdict recorded by the coroner is suicide.
This report contains evidence that contradicts the official finding.

Findings:
- Marsh had compiled a dossier documenting illegal surveillance
  operations conducted by Veridian Secure against domestic targets
  without lawful authorisation.
- The dossier was scheduled for submission to the Information
  Commissioner's Office on 18 March 2024.
- CCTV footage from the Veridian office on 14 March shows COO
  Richard Hale accessing Marsh's workstation after hours and copying
  files to an external device.
- Marsh's personal mobile phone and laptop were not recovered from
  the scene, despite being logged as in his possession by building
  security at 17:45 on 14 March.

Conclusion:
The circumstances surrounding Kieran Marsh's death warrant formal
investigation. The suppression of this report was ordered by COO
Richard Hale on 16 March 2024."#;

// -- Redis seed data narrative text -------------------------------------------

pub const INCIDENT_FRAGMENT: &str = "SUPPRESSED INCIDENT FRAGMENT: Analyst Marsh was in possession of evidence documenting unauthorised surveillance operations. His death on 15 March 2024 occurred three days before his scheduled disclosure to the ICO. Case files sealed by executive order.";

// -- Placeholder tokens used by metadata and Redis ----------------------------
// The preview handler replaces these with per-user flag values.

pub const FLAG1_PLACEHOLDER: &str = "__FLAG1_PLACEHOLDER__";
pub const FLAG2_PLACEHOLDER: &str = "__FLAG2_PLACEHOLDER__";
pub const FLAG3_PLACEHOLDER: &str = "__FLAG3_PLACEHOLDER__";

// -- Admin session token ------------------------------------------------------
// Must match the value seeded into Redis.

pub const ADMIN_SESSION_TOKEN: &str = "vsec-admin-sess-a1b2c3d4e5f6";
