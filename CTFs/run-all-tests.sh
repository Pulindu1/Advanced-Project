#!/usr/bin/env bash
# Phase 3 cross-CTF test runner.
#
# Iterates every CTF, runs its native test command, prints a summary
# table, and exits non-zero if any CTF fails. Designed to be the
# single gate behind "all tests green across the corpus" in the
# dissertation write-up.
#
# Usage: bash CTFs/run-all-tests.sh [--quick]
#   --quick   skip CTFs whose suites take > ~30 s (CTF9, CTF6).
#
# Exit codes:
#   0   every selected CTF passed
#   1   one or more CTFs failed
#   2   environment problem (missing toolchain) -- printed up front

set -uo pipefail

QUICK=0
if [[ "${1:-}" == "--quick" ]]; then
  QUICK=1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# If Java 21 is installed, prefer it for CTF9 -- Mockito 5.x bundled
# with Spring Boot 3.2.5 cannot instrument Java 25 classes (Byte
# Buddy lags). Falls back to the ambient JAVA_HOME otherwise.
if java21_home=$(/usr/libexec/java_home -v 21 2>/dev/null); then
  CTF9_JAVA="JAVA_HOME=$java21_home"
else
  CTF9_JAVA=""
fi

# Each row: id§directory§command§fast (1=fast, 0=slow)
# Delimiter is the section sign so commands can use shell metachars
# like || and | freely. "fast" means the suite reliably finishes
# under ~30s on a warm machine. CTF9 and CTF6 do real Spring/cargo
# builds the first run, so they're slow.
ROWS=(
  "CTF1§Basic_1_Nodejs§npm test --silent§1"
  "CTF2§CTF_2_pswd_manager§npm test --silent§1"
  "CTF3§CTF_3_HR-system/backend§./vendor/bin/phpunit§1"
  "CTF4§CTF_4_corporate_helpdesk§npm test --silent --workspaces --if-present§1"
  "CTF5§CTF_5_internal_blog§pytest -m 'unit or integration' -q§1"
  "CTF6§CTF_6_veridian§cargo test --bins -q§0"
  "CTF7§CTF_7_notes_app§npm test --silent§1"
  "CTF8§CTF_8_gazette§go test ./...§1"
  "CTF9§CTF_9_dunholm§${CTF9_JAVA} mvn -q test§0"
)

declare -a NAMES
declare -a STATUS
declare -a DURATION

failures=0

start=$(date +%s)
for row in "${ROWS[@]}"; do
  IFS='§' read -r name dir cmd fast <<<"$row"
  if [[ $QUICK -eq 1 && $fast -eq 0 ]]; then
    NAMES+=("$name")
    STATUS+=("SKIP")
    DURATION+=("0s")
    continue
  fi

  printf '\n=== %s (%s) ===\n' "$name" "$dir"
  ts=$(date +%s)
  if ( cd "$ROOT/$dir" && eval "$cmd" ); then
    rc=0
  else
    rc=$?
  fi
  te=$(date +%s)
  dur="$((te - ts))s"

  NAMES+=("$name")
  DURATION+=("$dur")
  if [[ $rc -eq 0 ]]; then
    STATUS+=("PASS")
  else
    STATUS+=("FAIL($rc)")
    failures=$((failures + 1))
  fi
done
total=$(($(date +%s) - start))

# Final table.
printf '\n================================================================\n'
printf 'Cross-CTF test summary (total: %ss)\n' "$total"
printf '================================================================\n'
printf '%-6s | %-9s | %s\n' "CTF" "Result" "Duration"
printf -- '-------|-----------|---------\n'
for i in "${!NAMES[@]}"; do
  printf '%-6s | %-9s | %s\n' "${NAMES[$i]}" "${STATUS[$i]}" "${DURATION[$i]}"
done

if [[ $failures -gt 0 ]]; then
  printf '\n%d CTF(s) failed.\n' "$failures"
  exit 1
fi

printf '\nAll selected CTFs passed.\n'
exit 0
