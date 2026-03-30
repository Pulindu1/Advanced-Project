import pytest
import json
import os
import tempfile
from app import create_app
from app.models import db as _db


@pytest.fixture(scope='session')
def app():
    """Create application for testing."""
    # Create temp dir for test instance
    test_dir = tempfile.mkdtemp()
    instance_dir = os.path.join(test_dir, 'instance')
    os.makedirs(instance_dir, exist_ok=True)
    secret_dir = os.path.join(test_dir, 'secret')
    os.makedirs(secret_dir, exist_ok=True)

    # Write test flags.json and credentials.json
    flags = {
        'testuser': {
            'flag1': 'durham-cms-flag1{test_flag1_testuser}',
            'flag2': 'durham-cms-flag2{test_flag2_testuser}',
            'flag3': 'durham-cms-flag3{test_flag3_testuser}',
            'flag4': 'durham-cms-flag4{test_flag4_testuser}',
        }
    }
    creds = {
        'testuser': {
            'password': 'testpass123',
            'role': 'editor',
        }
    }

    # Write to the app's parent directory (where seed.py expects them)
    app_dir = os.path.join(os.path.dirname(__file__), '..')
    with open(os.path.join(app_dir, 'flags.json'), 'w') as f:
        json.dump(flags, f)
    with open(os.path.join(app_dir, 'credentials.json'), 'w') as f:
        json.dump(creds, f)

    os.environ['DATABASE_URL'] = f'sqlite:///{os.path.join(instance_dir, "test.db")}'
    os.environ['SECRET_KEY'] = 'novacms-dev-2024'

    app = create_app()
    app.config['TESTING'] = True

    yield app


@pytest.fixture
def client(app):
    """Flask test client."""
    return app.test_client()


@pytest.fixture
def logged_in_client(client):
    """Test client with authenticated session."""
    client.post('/login', data={
        'username': 'testuser',
        'password': 'testpass123',
    })
    return client
