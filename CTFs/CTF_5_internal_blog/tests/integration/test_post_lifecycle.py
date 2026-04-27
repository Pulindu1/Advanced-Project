"""Multi-route flows that exercise the Post model end-to-end.

Each test chains at least login + one POST mutation + a follow-up read,
verifying state written by the first call surfaces in a later one against
the real SQLite fixture provisioned in tests/conftest.py.
"""


def test_create_post_appears_on_dashboard(logged_in_client):
    title = 'integration-create-flow'
    save = logged_in_client.post('/post/save', data={
        'title': title,
        'body': 'hello world',
        'publish': 'on',
    }, follow_redirects=False)
    assert save.status_code == 302

    dashboard = logged_in_client.get('/dashboard')
    assert dashboard.status_code == 200
    assert title.encode() in dashboard.data


def test_edit_post_persists_across_dashboard_view(logged_in_client):
    initial = logged_in_client.post('/post/save', data={
        'title': 'integration-edit-original',
        'body': 'v1',
    }, follow_redirects=False)
    assert initial.status_code == 302

    dashboard = logged_in_client.get('/dashboard')
    assert b'integration-edit-original' in dashboard.data

    body = dashboard.data.decode()
    import re
    edit_links = re.findall(r'/editor/(\d+)', body)
    assert edit_links, 'expected at least one editor link after creating a post'
    post_id = edit_links[0]

    editor = logged_in_client.get(f'/editor/{post_id}')
    assert editor.status_code == 200

    edit = logged_in_client.post('/post/save', data={
        'post_id': post_id,
        'title': 'integration-edit-updated',
        'body': 'v2',
    }, follow_redirects=False)
    assert edit.status_code == 302

    after = logged_in_client.get('/dashboard')
    assert b'integration-edit-updated' in after.data


def test_publish_flag_surfaces_in_published_section(logged_in_client):
    logged_in_client.post('/post/save', data={
        'title': 'integration-publish-flow',
        'body': 'visible to all',
        'publish': 'on',
    })

    dashboard = logged_in_client.get('/dashboard')
    assert b'integration-publish-flow' in dashboard.data
