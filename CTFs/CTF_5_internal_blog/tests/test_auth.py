def test_login_page_loads(client):
    resp = client.get('/login')
    assert resp.status_code == 200
    assert b'Login' in resp.data


def test_login_valid(client, test_player):
    resp = client.post('/login', data=test_player, follow_redirects=True)
    assert resp.status_code == 200
    assert b'Dashboard' in resp.data


def test_login_invalid(client, test_player):
    resp = client.post('/login', data={
        'username': test_player['username'],
        'password': 'wrongpassword',
    })
    assert resp.status_code == 401


def test_logout(logged_in_client):
    resp = logged_in_client.get('/logout', follow_redirects=True)
    assert resp.status_code == 200
    assert b'Login' in resp.data


def test_dashboard_requires_login(client):
    resp = client.get('/dashboard', follow_redirects=True)
    assert b'Login' in resp.data


def test_login_rate_limit(rate_limited_client, test_player):
    """After 10 failed attempts within 30 seconds, 11th should return 429."""
    client = rate_limited_client
    for i in range(10):
        resp = client.post('/login', data={
            'username': test_player['username'],
            'password': 'wrongpassword',
        })
        assert resp.status_code in (401, 429), f'Attempt {i+1} got unexpected {resp.status_code}'
    resp = client.post('/login', data={
        'username': test_player['username'],
        'password': 'wrongpassword',
    })
    assert resp.status_code == 429
