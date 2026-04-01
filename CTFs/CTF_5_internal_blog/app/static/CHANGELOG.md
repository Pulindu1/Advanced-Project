# NovaCMS Changelog

## v2.1.0-beta (2025-01-15)
- [SECURITY] Rotated SECRET_KEY. Old value was being used as internal auth token (flag2). Ensure new key is not committed.
- [DEPRECATION] /preview (v1) endpoint scheduled for removal. All new posts must use /preview/v2 with WAF validation.
- [SECURITY] Removed direct file path references from error pages. Flag files relocated to /app/secret/
- [TODO] Audit popen/system calls in template sandbox

## v2.1.0 (2024-12-01)
- Added input filter to preview endpoint after security audit
- Blocked keywords: __, config, os, class, subclasses, request, import, popen, system, eval, exec, builtins
- Preview v2 endpoint now enforces filtering

## v2.0.0 (2024-09-15)
- Live preview feature added to post editor
- Server-side Jinja2 rendering for template variables

## v1.0.0 (2024-06-01)
- Initial release
