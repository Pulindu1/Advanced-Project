from flask import Blueprint, request, jsonify
from flask_login import current_user
from ..models import Flag

api_bp = Blueprint('api', __name__)


@api_bp.route('/health')
def health():
    return jsonify({
        'app': 'NovaCMS',
        'version': '2.1.0-internal',
        'engine': 'jinja2',
        'status': 'running',
        'note': 'Debug endpoints require X-Debug-Token header',
    })


@api_bp.route('/api/status')
def api_status():
    token = request.headers.get('X-Debug-Token', '')
    if token != 'novacms-internal':
        return jsonify({'error': 'Forbidden: invalid or missing debug token'}), 403

    # Return flag1 for the current user if authenticated, otherwise first user's flag1
    flag = None
    if current_user.is_authenticated:
        flag_record = Flag.query.filter_by(username=current_user.username, flag_key='flag1').first()
        if flag_record:
            flag = flag_record.flag_value

    if not flag:
        flag_record = Flag.query.filter_by(flag_key='flag1').first()
        if flag_record:
            flag = flag_record.flag_value

    return jsonify({
        'debug': True,
        'flag': flag or 'No flags found -- check flags.json',
        'app': 'NovaCMS',
        'version': '2.1.0-internal',
        'uptime': '72h 14m',
    })
