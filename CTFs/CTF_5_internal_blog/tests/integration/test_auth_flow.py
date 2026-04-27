"""Multi-route auth lifecycle: protected route bounces anonymous user,
then login + protected access + logout + protected re-bounce as one chain.
"""


def test_login_logout_cycle_protects_dashboard(client, test_player):
    pre = client.get('/dashboard', follow_redirects=False)
    assert pre.status_code == 302
    assert '/login' in pre.headers['Location']

    login = client.post('/login', data=test_player, follow_redirects=False)
    assert login.status_code == 302
    assert '/dashboard' in login.headers['Location']

    after_login = client.get('/dashboard')
    assert after_login.status_code == 200
    assert b'Dashboard' in after_login.data

    logout = client.get('/logout', follow_redirects=False)
    assert logout.status_code == 302

    post_logout = client.get('/dashboard', follow_redirects=False)
    assert post_logout.status_code == 302
    assert '/login' in post_logout.headers['Location']


def test_session_persists_across_distinct_routes(client, test_player):
    client.post('/login', data=test_player)

    editor = client.get('/editor')
    assert editor.status_code == 200

    dashboard = client.get('/dashboard')
    assert dashboard.status_code == 200

    health = client.get('/health')
    assert health.status_code == 200
    assert b'NovaCMS' in health.data
