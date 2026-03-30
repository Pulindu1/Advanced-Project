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
        from .seed import seed_database
        seed_database(app)

    # Load Flag 3 into os.environ so it's accessible via WAF bypass (os.environ)
    # but NOT visible in {{config}} on the unfiltered v1 endpoint.
    flags_path = os.path.join(app.root_path, '..', 'flags.json')
    try:
        with open(flags_path) as f:
            flags_data = json.load(f)
        first_flag3 = next(
            (v['flag3'] for v in flags_data.values() if 'flag3' in v),
            None
        )
        if first_flag3:
            os.environ.setdefault('WAF_FLAG3', first_flag3)
    except (FileNotFoundError, KeyError):
        pass

    return app
