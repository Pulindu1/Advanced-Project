import pytest
import json
import os
import secrets
import tempfile
from app import create_app, limiter
from app.models import db as _db

TEST_PLAYER = 'test12'


def pytest_collection_modifyitems(config, items):
    """Auto-mark tests by directory: tests/integration/* gets `integration`,
    everything else gets `unit`. Keeps the workflow §2 rubric enforceable
    via `pytest -m unit` / `pytest -m integration`.
    """
    for item in items:
        path = str(item.fspath)
        if os.sep + 'tests' + os.sep + 'integration' + os.sep in path:
            item.add_marker(pytest.mark.integration)
        else:
            item.add_marker(pytest.mark.unit)


@pytest.fixture(scope='session')
def test_password():
    """Random password for the test player, generated once per session."""
    return secrets.token_urlsafe(12)


@pytest.fixture(scope='session')
def app(test_password):
    """Create application for testing."""
    test_dir = tempfile.mkdtemp()
    instance_dir = os.path.join(test_dir, 'instance')
    os.makedirs(instance_dir, exist_ok=True)
    os.makedirs(os.path.join(test_dir, 'secret'), exist_ok=True)

    flags = {
        TEST_PLAYER: {
            'flag1': f'durham-cms-flag1{{test_flag1_{TEST_PLAYER}}}',
            'flag2': f'durham-cms-flag2{{test_flag2_{TEST_PLAYER}}}',
            'flag3': f'durham-cms-flag3{{test_flag3_{TEST_PLAYER}}}',
            'flag4': f'durham-cms-flag4{{test_flag4_{TEST_PLAYER}}}',
        }
    }
    creds = {
        'admin': {
            'password': 'SYSTEM_INTERNAL',
            'role': 'admin',
        },
        TEST_PLAYER: {
            'password': test_password,
            'role': 'editor',
        },
    }

    app_dir = os.path.join(os.path.dirname(__file__), '..')
    with open(os.path.join(app_dir, 'flags.json'), 'w') as f:
        json.dump(flags, f)
    with open(os.path.join(app_dir, 'credentials.json'), 'w') as f:
        json.dump(creds, f)

    db_url = f'sqlite:///{os.path.join(instance_dir, "test.db")}'
    os.environ['DATABASE_URL'] = db_url
    os.environ['SECRET_KEY'] = 'novacms-dev-2024'

    # Override Config before create_app reads it
    from app.config import Config
    Config.SQLALCHEMY_DATABASE_URI = db_url

    app = create_app()
    app.config['TESTING'] = True
    # Disable rate limiting for all tests except the rate limit test itself
    app.config['RATELIMIT_ENABLED'] = False

    yield app


@pytest.fixture
def client(app):
    """Flask test client with rate limiting disabled."""
    return app.test_client()


@pytest.fixture
def rate_limited_client(app):
    """Flask test client with rate limiting enabled."""
    app.config['RATELIMIT_ENABLED'] = True
    limiter.reset()
    client = app.test_client()
    yield client
    app.config['RATELIMIT_ENABLED'] = False
    limiter.reset()


@pytest.fixture
def test_player(test_password):
    """Canonical test player credentials."""
    return {'username': TEST_PLAYER, 'password': test_password}


@pytest.fixture
def logged_in_client(client, test_player):
    """Test client with authenticated session."""
    client.post('/login', data=test_player)
    return client
