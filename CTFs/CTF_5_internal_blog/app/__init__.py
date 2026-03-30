from flask import Flask
from flask_login import LoginManager
from .config import Config
from .models import db, User


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # Initialise extensions
    db.init_app(app)
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

    # Seed database on first request
    with app.app_context():
        from .seed import seed_database
        seed_database(app)

    return app
