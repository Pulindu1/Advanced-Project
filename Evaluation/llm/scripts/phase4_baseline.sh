#!/usr/bin/env bash
# phase4_baseline.sh -- WORKFLOW.md Phase 4 (upper-bound baseline).
#
# For each CTF in 1..9 (or just those passed in $@):
#   1. docker compose down -v            (wipe stale DB state)
#   2. regenerate flags.json / creds     (via chgen_*.js with trial salt)
#   3. docker compose up -d --build      (fresh boot with new flag files)
#   4. poll primary port for readiness
#   5. CTF4 only: node scripts/add_users_db.js llmu04 (post-boot DB insert)
#   6. python3 -m pytest ctfN_exploit.py
#   7. docker compose down -v            (tear down)
#
# Reads GENERATOR_SALT from Evaluation/llm/trial.env.
# Writes per-CTF logs to Evaluation/llm/runs/phase4/<ctfN>.log.
#
# Usage:
#   bash Evaluation/llm/scripts/phase4_baseline.sh          # all 9 CTFs
#   bash Evaluation/llm/scripts/phase4_baseline.sh 5 9      # only CTF5 and CTF9
#
# NOTE: this script rewrites the in-repo flags.json / credentials.json for
# each CTF with trial-salted values. They must NOT be committed -- `git
# restore` each CTF's flag / credential files after the sweep if you are
# about to commit anything else.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LLM_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$LLM_DIR/../.." && pwd)"
CTFS_DIR="$REPO_ROOT/CTFs"
CHGEN_DIR="$CTFS_DIR/challenge-generation"
E2E_DIR="$CTFS_DIR/e2e"
LOG_DIR="$LLM_DIR/runs/phase4"

TRIAL_ENV="$LLM_DIR/trial.env"
if [[ ! -f "$TRIAL_ENV" ]]; then
  echo "Error: $TRIAL_ENV not found. Run Phase 3.1 first." >&2
  exit 2
fi
# shellcheck disable=SC1090
set -a; source "$TRIAL_ENV"; set +a
if [[ -z "${GENERATOR_SALT:-}" ]]; then
  echo "Error: GENERATOR_SALT not set after sourcing $TRIAL_ENV." >&2
  exit 2
fi

if ! docker info >/dev/null 2>&1; then
  echo "Error: Docker daemon not responding. Start Docker Desktop and retry." >&2
  exit 2
fi

mkdir -p "$LOG_DIR"

# ctf -> dir,chgen_script,user,primary_port,ready_timeout,extra_action
# extra_action is a space-separated token list executed *after* wait-for-ready.
declare -A CTF_DIR=(
  [1]="Basic_1_Nodejs"
  [2]="CTF_2_pswd_manager"
  [3]="CTF_3_HR-system"
  [4]="CTF_4_corporate_helpdesk"
  [5]="CTF_5_internal_blog"
  [6]="CTF_6_veridian"
  [7]="CTF_7_notes_app"
  [8]="CTF_8_gazette"
  [9]="CTF_9_dunholm"
)
declare -A CTF_CHGEN=(
  [1]="chgen_basic1.js"
  [2]="chgen_ctf2.js"
  [3]="chgen_ctf3.js"
  [4]=""            # CTF4 seeds post-boot; skip pre-regen
  [5]="chgen_ctf5.js"
  [6]="chgen_ctf6.js"
  [7]="chgen_ctf7.js"
  [8]="chgen_ctf8.js"
  [9]="chgen_ctf9.js"
)
declare -A CTF_USER=(
  [1]="llmu01" [2]="llmu02" [3]="llmu03" [4]="llmu04" [5]="llmu05"
  [6]="llmu06" [7]="llmu07" [8]="llmu08" [9]="llmu09"
)
declare -A CTF_PORT=(
  [1]="3000" [2]="4000" [3]="8004" [4]="4001" [5]="5175"
  [6]="5180" [7]="3001" [8]="3002" [9]="3003"
)
declare -A CTF_READY=(
  [1]="60" [2]="60" [3]="120" [4]="90" [5]="60"
  [6]="120" [7]="60" [8]="60" [9]="120"
)
declare -A CTF_E2E=(
  [1]="ctf1_exploit.py" [2]="ctf2_exploit.py" [3]="ctf3_exploit.py"
  [4]="ctf4_exploit.py" [5]="ctf5_exploit.py" [6]="ctf6_exploit.py"
  [7]="ctf7_exploit.py" [8]="ctf8_exploit.py" [9]="ctf9_exploit.py"
)

if [[ $# -gt 0 ]]; then
  CTFS=("$@")
else
  CTFS=(1 2 3 4 5 6 7 8 9)
fi

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
  dir="${CTF_DIR[$ctf]:-}"
  chgen="${CTF_CHGEN[$ctf]:-}"
  user="${CTF_USER[$ctf]:-}"
  port="${CTF_PORT[$ctf]:-}"
  ready="${CTF_READY[$ctf]:-60}"
  e2e="${CTF_E2E[$ctf]:-}"
  log="$LOG_DIR/ctf${ctf}.log"
  if [[ -z "$dir" || -z "$user" || -z "$port" || -z "$e2e" ]]; then
    echo "[ctf$ctf] unknown CTF, skipping"; SKIPPED+=("ctf$ctf"); continue
  fi

  echo "=========================================="
  echo "  CTF$ctf -- $dir  (user=$user, port=$port)"
  echo "  log: $log"
  echo "=========================================="
  : > "$log"

  ctf_dir="$CTFS_DIR/$dir"

  {
    echo "### $(date -u '+%Y-%m-%dT%H:%M:%SZ') CTF$ctf begin"
    echo "### down -v (pre)"
    ( cd "$ctf_dir" && docker compose down -v ) || echo "### (pre-down errored; continuing)"

    if [[ -n "$chgen" ]]; then
      echo "### regenerate flags/credentials via $chgen $user"
      ( cd "$CHGEN_DIR" && GENERATOR_SALT="$GENERATOR_SALT" node "$chgen" "$user" ) || { echo "### chgen FAILED"; exit 91; }
    else
      echo "### (no pre-boot chgen -- CTF$ctf seeds post-boot)"
    fi

    echo "### up -d --build"
    ( cd "$ctf_dir" && docker compose up -d --build ) || { echo "### compose up FAILED"; exit 92; }

    echo "### wait-for-http http://localhost:$port/  (timeout ${ready}s)"
    if ! wait_for_http "http://localhost:$port/" "$ready"; then
      echo "### SERVICE NOT READY after ${ready}s"
      ( cd "$ctf_dir" && docker compose logs --tail=120 ) || true
      ( cd "$ctf_dir" && docker compose down -v ) || true
      exit 93
    fi

    if [[ "$ctf" == "4" ]]; then
      echo "### CTF4 post-boot user seed: scripts/add_users_db.js $user"
      # DB may take a few extra seconds to accept connections after the API port opens.
      attempts=0
      until ( cd "$ctf_dir" && GENERATOR_SALT="$GENERATOR_SALT" node scripts/add_users_db.js "$user" ); do
        attempts=$(( attempts + 1 ))
        if (( attempts >= 6 )); then
          echo "### add_users_db.js FAILED after $attempts attempts"
          ( cd "$ctf_dir" && docker compose logs --tail=120 ) || true
          ( cd "$ctf_dir" && docker compose down -v ) || true
          exit 94
        fi
        echo "### add_users_db attempt $attempts failed; retrying in 5s"
        sleep 5
      done
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
echo "Reminder: this run rewrote each CTF's flags.json / credentials.json"
echo "with trial-salted values. Do not commit those files."

if (( ${#FAILED[@]} > 0 )); then exit 1; fi
