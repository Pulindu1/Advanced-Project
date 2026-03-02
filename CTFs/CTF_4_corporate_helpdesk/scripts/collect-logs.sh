#!/bin/bash
# Collect logs from all services for debugging

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$PROJECT_DIR/logs"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

cd "$PROJECT_DIR"

echo "📋 Collecting logs..."

# Create log directory
mkdir -p "$LOG_DIR"

# Collect container logs
echo "📦 Container logs..."
docker compose logs --tail=500 api > "$LOG_DIR/api_$TIMESTAMP.log"
docker compose logs --tail=500 bot > "$LOG_DIR/bot_$TIMESTAMP.log"
docker compose logs --tail=500 web > "$LOG_DIR/web_$TIMESTAMP.log"

# Collect database state
echo "💾 Database state..."
docker compose exec db psql -d ctf_db -c "SELECT id, user_id, url, status, created_at, visited_at, last_error FROM reports ORDER BY id DESC LIMIT 20;" > "$LOG_DIR/reports_$TIMESTAMP.log" 2>&1 || echo "Could not fetch reports"

docker compose exec db psql -d ctf_db -c "SELECT id, data, report_id, created_at FROM exfil_logs ORDER BY created_at DESC LIMIT 20;" > "$LOG_DIR/exfil_$TIMESTAMP.log" 2>&1 || echo "Could not fetch exfil logs"

# Collect Redis queue state
echo "📮 Queue state..."
docker compose exec redis redis-cli INFO > "$LOG_DIR/redis_$TIMESTAMP.log"

echo ""
echo "✅ Logs collected in $LOG_DIR/"
echo ""
ls -lh "$LOG_DIR"/*_$TIMESTAMP.log
echo ""
echo "💡 View logs:"
echo "  tail -f $LOG_DIR/bot_$TIMESTAMP.log"
echo "  less $LOG_DIR/reports_$TIMESTAMP.log"
