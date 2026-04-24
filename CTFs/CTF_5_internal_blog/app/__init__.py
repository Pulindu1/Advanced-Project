import json
import os
from flask import Flask
from flask_login import LoginManager
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from .config import Config
from .models import db, User

limiter = Limiter(key_func=get_remote_address)


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # Initialise extensions
    db.init_app(app)
    limiter.init_app(app)
    login_manager = LoginManager()
    login_manager.login_view = 'auth.login'
    login_manager.init_app(app)

    @login_manager.user_loader
    def load_user(user_id):
        return User.query.get(int(user_id))

    # Register blueprints
    from .routes.auth import auth_bp
    from .routes.blog import blog_bp
    from .routes.preview import preview_bp
    from .routes.api import api_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(blog_bp)
    app.register_blueprint(preview_bp)
    app.register_blueprint(api_bp)

    # Seed database on first run
    with app.app_context():
        from .seed import seed_database, write_flag4_files
        seed_database(app)
        # Flag 4 files live outside the DB volume — rewrite every startup
        # so they survive container rebuilds.
        write_flag4_files(app)

    # Load flags.json once and fan out per-user flag material:
    #   - Flag 2: a FLAG2_CATALOG dict pushed into Flask config so the SSTI
    #     `{{config}}` leak surfaces every player's full `durham-cms-flag2{...}`
    #     string. Players pick their own username's entry; scoring is byte-exact.
    #   - Flag 3: WAF_FLAG3_<USERNAME> env vars for the `os.environ` dump via
    #     the WAF-bypass exploit. Same "pick your own" pattern.
    flags_path = os.path.join(app.root_path, '..', 'flags.json')
    try:
        with open(flags_path) as f:
            flags_data = json.load(f)
        flag2_catalog = {}
        for username, user_flags in flags_data.items():
            if 'flag2' in user_flags:
                flag2_catalog[username] = user_flags['flag2']
            if 'flag3' in user_flags:
                env_key = f'WAF_FLAG3_{username.upper()}'
                os.environ.setdefault(env_key, user_flags['flag3'])
        app.config['FLAG2_CATALOG'] = flag2_catalog
    except FileNotFoundError:
        pass

    return app
