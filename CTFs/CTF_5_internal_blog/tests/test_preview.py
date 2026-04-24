def test_ssti_basic(logged_in_client):
    """{{7*7}} should return 49."""
    resp = logged_in_client.post('/preview', data={'body': '{{7*7}}'})
    assert resp.status_code == 200
    assert b'49' in resp.data


def test_config_leak(logged_in_client, test_player):
    """{{config}} should leak FLAG2_CATALOG with the test player's flag2."""
    resp = logged_in_client.post('/preview', data={'body': '{{config}}'})
    assert resp.status_code == 200
    assert b'FLAG2_CATALOG' in resp.data
    assert b'durham-cms-flag2{' in resp.data
    assert test_player['username'].encode() in resp.data


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
