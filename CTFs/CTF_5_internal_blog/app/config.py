import os

basedir = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'novacms-dev-2024')
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        'DATABASE_URL',
        'sqlite:///' + os.path.join(basedir, 'instance', 'novacms.db')
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    FLAG_PREFIX = 'durham-cms'
