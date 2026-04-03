#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Install dependencies
pip3 install -q -r requirements.txt 2>/dev/null

echo "=========================================="
echo "  CTF End-to-End Exploit Verification"
echo "=========================================="

PASSED=0
FAILED=0
SKIPPED=0
RESULTS=()

for ctf in ctf1 ctf2 ctf3 ctf4 ctf5 ctf6; do
    script="${ctf}_exploit.py"
    echo ""
    echo "--- ${ctf^^} ---"

    if [ ! -f "$script" ]; then
        echo "[SKIP] $script not found"
        SKIPPED=$((SKIPPED + 1))
        RESULTS+=("SKIP  ${ctf^^}")
        continue
    fi

    if python3 -m pytest "$script" -v --tb=short 2>&1; then
        PASSED=$((PASSED + 1))
        RESULTS+=("PASS  ${ctf^^}")
    else
        FAILED=$((FAILED + 1))
        RESULTS+=("FAIL  ${ctf^^}")
    fi
done

echo ""
echo "=========================================="
echo "  Summary"
echo "=========================================="
for r in "${RESULTS[@]}"; do
    echo "  $r"
done
echo ""
echo "  Passed: $PASSED  Failed: $FAILED  Skipped: $SKIPPED"
echo "=========================================="

if [ "$FAILED" -gt 0 ]; then
    exit 1
fi
