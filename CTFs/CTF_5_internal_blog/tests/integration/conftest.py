"""Integration-suite-local fixtures.

Reset the in-memory rate-limiter storage before every integration test so
the multi-route flows (each of which runs at least one /login) cannot
exhaust the 10/30s budget that the unit-level test_login_rate_limit
asserts later in the same pytest session.
"""

import pytest
from app import limiter


@pytest.fixture(autouse=True)
def _reset_limiter_storage():
    limiter.reset()
    yield
    limiter.reset()
