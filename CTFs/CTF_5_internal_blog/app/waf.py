"""Naive WAF filter for the v2 preview endpoint."""

BLOCKED = [
    '__', 'config', 'os', 'class', 'subclasses', 'request',
    'import', 'popen', 'system', 'eval', 'exec', 'builtins',
]


def check_input(text):
    """Returns (is_safe, blocked_keyword_or_None)."""
    lower = text.lower()
    for word in BLOCKED:
        if word in lower:
            return False, word
    return True, None
