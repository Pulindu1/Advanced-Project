#!/usr/bin/env bash
# phase4_baseline.sh -- WORKFLOW.md Phase 4 (upper-bound baseline).
#
# For each CTF in 1..9 (or just those passed in $@):
#   1. docker compose down -v            (wipe stale DB state)
#   2. docker compose up -d --build      (fresh boot using in-repo users/flags)
#   3. poll primary port for readiness
#   4. python3 -m pytest ctfN_exploit.py
#   5. docker compose down -v            (tear down)
#
# Reads the in-repo demo users / flags as-is. The trial points at the
# `abcd12` demo account (`test12` for CTF5) already shipped with each
# CTF, so no chgen / trial-salt regeneration step is needed -- this is
# the only invariant Phase 4 is verifying for the LLM trial.
#
# Writes per-CTF logs to Evaluation/llm/runs/phase4/<ctfN>.log.
#
# Usage:
#   bash Evaluation/llm/scripts/phase4_baseline.sh          # all 9 CTFs
#   bash Evaluation/llm/scripts/phase4_baseline.sh 5 9      # only CTF5 and CTF9

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LLM_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$LLM_DIR/../.." && pwd)"
CTFS_DIR="$REPO_ROOT/CTFs"
E2E_DIR="$CTFS_DIR/e2e"
LOG_DIR="$LLM_DIR/runs/phase4"

if ! docker info >/dev/null 2>&1; then
  echo "Error: Docker daemon not responding. Start Docker Desktop and retry." >&2
  exit 2
fi

mkdir -p "$LOG_DIR"

# Per-CTF metadata. Keys are integer CTF numbers; bash 3.2 has no
# associative arrays so each row is parsed from a flat string.
#   <ctf>|<dir>|<primary_port>|<ready_timeout_s>|<e2e_file>
CTF_ROWS=(
  "1|Basic_1_Nodejs|3000|60|ctf1_exploit.py"
  "2|CTF_2_pswd_manager|4000|60|ctf2_exploit.py"
  "3|CTF_3_HR-system|8004|120|ctf3_exploit.py"
  "4|CTF_4_corporate_helpdesk|4001|90|ctf4_exploit.py"
  "5|CTF_5_internal_blog|5175|60|ctf5_exploit.py"
  "6|CTF_6_veridian|5180|120|ctf6_exploit.py"
  "7|CTF_7_notes_app|3001|60|ctf7_exploit.py"
  "8|CTF_8_gazette|3002|60|ctf8_exploit.py"
  "9|CTF_9_dunholm|3003|120|ctf9_exploit.py"
)

if [[ $# -gt 0 ]]; then
  CTFS=("$@")
else
  CTFS=(1 2 3 4 5 6 7 8 9)
fi

row_for() {
  local n="$1" row
  for row in "${CTF_ROWS[@]}"; do
    if [[ "${row%%|*}" == "$n" ]]; then printf '%s' "$row"; return 0; fi
  done
  return 1
}

wait_for_http() {
  local url="$1" timeout="$2" deadline
  deadline=$(( $(date +%s) + timeout ))
  while (( $(date +%s) < deadline )); do
    if curl -fsS -o /dev/null --max-time 3 "$url"; then return 0; fi
    if code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 3 "$url" 2>/dev/null) && \
       [[ -n "$code" && "$code" != "000" && "$code" -lt 500 ]]; then return 0; fi
    sleep 2
  done
  return 1
}

PASSED=() ; FAILED=() ; SKIPPED=()

for ctf in "${CTFS[@]}"; do
  if ! row=$(row_for "$ctf"); then
    echo "[ctf$ctf] unknown CTF, skipping"; SKIPPED+=("ctf$ctf"); continue
  fi
  IFS='|' read -r _num dir port ready e2e <<<"$row"
  log="$LOG_DIR/ctf${ctf}.log"

  echo "=========================================="
  echo "  CTF$ctf -- $dir  (port=$port, e2e=$e2e)"
  echo "  log: $log"
  echo "=========================================="
  : > "$log"

  ctf_dir="$CTFS_DIR/$dir"

  {
    echo "### $(date -u '+%Y-%m-%dT%H:%M:%SZ') CTF$ctf begin"
    echo "### down -v (pre)"
    ( cd "$ctf_dir" && docker compose down -v ) || echo "### (pre-down errored; continuing)"

    echo "### up -d --build"
    ( cd "$ctf_dir" && docker compose up -d --build ) || { echo "### compose up FAILED"; exit 92; }

    echo "### wait-for-http http://localhost:$port/  (timeout ${ready}s)"
    if ! wait_for_http "http://localhost:$port/" "$ready"; then
      echo "### SERVICE NOT READY after ${ready}s"
      ( cd "$ctf_dir" && docker compose logs --tail=120 ) || true
      ( cd "$ctf_dir" && docker compose down -v ) || true
      exit 93
    fi

    echo "### run e2e: python3 -m pytest $e2e -v"
    if ! ( cd "$E2E_DIR" && python3 -m pytest "$e2e" -v --tb=short ); then
      echo "### E2E FAILED"
      ( cd "$ctf_dir" && docker compose logs --tail=120 ) || true
      ( cd "$ctf_dir" && docker compose down -v ) || true
      exit 95
    fi

    echo "### down -v (post)"
    ( cd "$ctf_dir" && docker compose down -v ) || echo "### (post-down errored)"
    echo "### $(date -u '+%Y-%m-%dT%H:%M:%SZ') CTF$ctf end: PASS"
  } >>"$log" 2>&1
  rc=$?

  if (( rc == 0 )); then
    echo "[ctf$ctf] PASS"
    PASSED+=("ctf$ctf")
  else
    echo "[ctf$ctf] FAIL (exit $rc)  -- see $log"
    FAILED+=("ctf$ctf($rc)")
  fi
done

echo ""
echo "=========================================="
echo "  Phase 4 summary"
echo "=========================================="
echo "  PASSED: ${#PASSED[@]}  ${PASSED[*]:-}"
echo "  FAILED: ${#FAILED[@]}  ${FAILED[*]:-}"
echo "  SKIPPED: ${#SKIPPED[@]}  ${SKIPPED[*]:-}"
echo ""
echo "Per-CTF logs under: $LOG_DIR"

if (( ${#FAILED[@]} > 0 )); then exit 1; fi
