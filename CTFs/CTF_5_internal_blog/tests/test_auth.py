def test_login_page_loads(client):
    resp = client.get('/login')
    assert resp.status_code == 200
    assert b'Login' in resp.data


def test_login_valid(client):
    resp = client.post('/login', data={
        'username': 'testuser',
        'password': 'testpass123',
    }, follow_redirects=True)
    assert resp.status_code == 200
    assert b'Dashboard' in resp.data


def test_login_invalid(client):
    resp = client.post('/login', data={
        'username': 'testuser',
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
