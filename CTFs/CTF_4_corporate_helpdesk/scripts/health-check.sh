#!/bin/bash
# Health check for CTF Challenge

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "🏥 CTF Challenge Health Check"
echo "=============================="
echo ""

# Check containers
echo "📦 Container Status:"
docker compose ps | grep -E "(intradesk-|NAME)" || echo "No containers running"
echo ""

# Check services
echo "🌐 Service Health:"
curl -s http://localhost:4001/health > /dev/null && echo "✅ API (4001)" || echo "❌ API (4001) not responding"
curl -s http://localhost:5176 > /dev/null && echo "✅ Web (5176)" || echo "❌ Web (5176) not responding"
echo ""

# Database stats
echo "💾 Database Stats:"
docker compose exec db psql -d ctf_db -t -c "SELECT COUNT(*) FROM users;" 2>/dev/null | xargs echo "Users:" || echo "Cannot query DB"
docker compose exec db psql -d ctf_db -t -c "SELECT COUNT(*) FROM kb_articles;" 2>/dev/null | xargs echo "KB Articles:" || echo "Cannot query DB"
docker compose exec db psql -d ctf_db -t -c "SELECT COUNT(*) FROM reports;" 2>/dev/null | xargs echo "Reports:" || echo "Cannot query DB"
docker compose exec db psql -d ctf_db -t -c "SELECT COUNT(*) FROM exfil_logs;" 2>/dev/null | xargs echo "Exfil Logs:" || echo "Cannot query DB"
echo ""

# Recent reports
echo "📋 Recent Reports (last 5):"
docker compose exec db psql -d ctf_db -c "SELECT id, status, created_at, visited_at FROM reports ORDER BY id DESC LIMIT 5;" 2>/dev/null || echo "Cannot query reports"
echo ""

# Queue status
echo "📮 Queue Status:"
QUEUE_SIZE=$(docker compose exec redis redis-cli LLEN "bull:reports:wait" 2>/dev/null || echo "0")
echo "Pending jobs: $QUEUE_SIZE"
echo ""

# Environment check
echo "⚙️  Configuration:"
if [ -f .env ]; then
  grep -q "FLAG_SECRET=" .env && echo "✅ FLAG_SECRET configured" || echo "❌ FLAG_SECRET missing"
  grep -q "ADMIN_USERNAME=" .env && echo "✅ ADMIN_USERNAME configured" || echo "❌ ADMIN_USERNAME missing"
else
  echo "❌ .env file not found"
fi
echo ""

echo "✅ Health check complete"
