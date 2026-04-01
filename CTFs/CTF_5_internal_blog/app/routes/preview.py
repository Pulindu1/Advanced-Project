from flask import Blueprint, request, render_template_string, jsonify, session
from flask_login import login_required, current_user
from ..waf import check_input
from ..models import Flag

preview_bp = Blueprint('preview', __name__)


@preview_bp.route('/preview', methods=['POST'])
@login_required
def preview_v1():
    """Unfiltered preview -- SSTI surface for Flag 2."""
    body = request.form.get('body', '')

    session['v1_count'] = session.get('v1_count', 0) + 1
    deprecation = ''
    if session['v1_count'] >= 5:
        deprecation = '<div class="deprecation-notice" style="background:#fff3cd;border:1px solid #ffc107;padding:8px 12px;margin-bottom:12px;border-radius:4px;">&#9888; /preview (v1) is deprecated. Switch to /preview/v2 for production-safe rendering.</div>'

    try:
        rendered = render_template_string(body)
    except Exception as e:
        rendered = f'<div class="error">Template error: {e}</div>'
    return deprecation + rendered


@preview_bp.route('/preview/v2', methods=['POST'])
@login_required
def preview_v2():
    """WAF-filtered preview -- bypass needed for Flags 3 & 4."""
    body = request.form.get('body', '')

    is_safe, blocked_word = check_input(body)
    if not is_safe:
        return (
            f'<div class="error">Blocked: input contains forbidden keyword \'{blocked_word}\'.</div>'
            f'<div class="hint" style="color:#666;font-size:0.9em;margin-top:8px;">'
            f'Blocked keywords listed in <a href="/static/CHANGELOG.md">/static/CHANGELOG.md</a>. '
            f'Hex encoding (\\x5f\\x5f) can represent blocked characters.</div>'
        ), 400

    try:
        rendered = render_template_string(body)
    except Exception as e:
        rendered = f'<div class="error">Template error: {e}</div>'
    return rendered
