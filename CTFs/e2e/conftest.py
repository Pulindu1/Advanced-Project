"""Shared fixtures for CTF end-to-end exploit verification."""
import json
import os
import time

import requests


E2E_DIR = os.path.dirname(os.path.abspath(__file__))
CTFS_DIR = os.path.dirname(E2E_DIR)


def wait_for_service(url, timeout=60, interval=2):
    """Block until service responds with a non-5xx status, or raise after timeout."""
    deadline = time.time() + timeout
    last_err = None
    while time.time() < deadline:
        try:
            r = requests.get(url, timeout=5)
            if r.status_code < 500:
                return
        except requests.ConnectionError as e:
            last_err = e
        time.sleep(interval)
    raise TimeoutError(
        f"Service {url} not ready after {timeout}s (last error: {last_err})"
    )


def load_credentials(ctf_dir, username=None):
    """Load credentials from a CTF's credentials.json.

    If username is None, returns (username, password) for the first non-admin user.
    If username is given, returns just the password string.
    """
    path = os.path.join(CTFS_DIR, ctf_dir, "credentials.json")
    with open(path) as f:
        creds = json.load(f)

    if username is None:
        for uname, data in creds.items():
            if uname in ("admin", "flag12") or uname.endswith("-bot"):
                continue
            pwd = data["password"] if isinstance(data, dict) else data
            return uname, pwd
        raise KeyError("No regular user found in credentials.json")

    data = creds[username]
    return data["password"] if isinstance(data, dict) else data


def load_flags(ctf_dir, username=None):
    """Load flags from a CTF's flags.json.

    If username is None, returns (username, flags_dict) for the first user.
    If username is given, returns the flags dict/string for that user.
    """
    path = os.path.join(CTFS_DIR, ctf_dir, "flags.json")
    with open(path) as f:
        flags = json.load(f)

    if username is None:
        for uname, data in flags.items():
            return uname, data
        raise KeyError("No user found in flags.json")

    return flags[username]
