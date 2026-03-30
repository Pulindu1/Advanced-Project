def test_ssti_basic(logged_in_client):
    """{{7*7}} should return 49."""
    resp = logged_in_client.post('/preview', data={'body': '{{7*7}}'})
    assert resp.status_code == 200
    assert b'49' in resp.data


def test_config_leak(logged_in_client):
    """{{config}} should reveal SECRET_KEY."""
    resp = logged_in_client.post('/preview', data={'body': '{{config}}'})
    assert resp.status_code == 200
    assert b'novacms-dev-2024' in resp.data


def test_waf_blocks_config(logged_in_client):
    """WAF should block {{config}} on v2."""
    resp = logged_in_client.post('/preview/v2', data={'body': '{{config}}'})
    assert resp.status_code == 400
    assert b'Blocked' in resp.data


def test_waf_blocks_dunders(logged_in_client):
    """WAF should block __ on v2."""
    resp = logged_in_client.post('/preview/v2', data={'body': '{{"".__class__}}'})
    assert resp.status_code == 400
    assert b'Blocked' in resp.data


def test_preview_requires_login(client):
    """Preview should require authentication."""
    resp = client.post('/preview', data={'body': '{{7*7}}'}, follow_redirects=True)
    assert b'Login' in resp.data
