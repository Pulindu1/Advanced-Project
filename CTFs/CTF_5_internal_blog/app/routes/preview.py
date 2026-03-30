from flask import Blueprint, request, render_template_string, jsonify
from flask_login import login_required, current_user
from ..waf import check_input
from ..models import Flag

preview_bp = Blueprint('preview', __name__)


@preview_bp.route('/preview', methods=['POST'])
@login_required
def preview_v1():
    """Unfiltered preview -- SSTI surface for Flag 2."""
    body = request.form.get('body', '')
    try:
        rendered = render_template_string(body)
    except Exception as e:
        rendered = f'<div class="error">Template error: {e}</div>'
    return rendered


@preview_bp.route('/preview/v2', methods=['POST'])
@login_required
def preview_v2():
    """WAF-filtered preview -- bypass needed for Flags 3 & 4."""
    body = request.form.get('body', '')

    is_safe, blocked_word = check_input(body)
    if not is_safe:
        return f'<div class="error">Blocked: input contains forbidden keyword \'{blocked_word}\'</div>', 400

    try:
        rendered = render_template_string(body)
    except Exception as e:
        rendered = f'<div class="error">Template error: {e}</div>'
    return rendered
