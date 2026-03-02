#!/bin/bash
# Reset CTF Challenge - Clears all reports, exfil logs, and optionally rotates flag secret

set -e

echo "🔄 Resetting CTF Challenge..."

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Check if we should rotate flag secret
ROTATE_FLAG=""
if [ "$1" = "--rotate-flag" ]; then
  ROTATE_FLAG="yes"
  echo "🔐 Will rotate FLAG_SECRET"
fi

# Clear reports and exfil logs from database
echo "🗑️  Clearing reports and exfil logs..."
docker compose exec db psql -d ctf_db -c "DELETE FROM exfil_logs;"
docker compose exec db psql -d ctf_db -c "DELETE FROM reports;"
docker compose exec db psql -d ctf_db -c "SELECT setval('reports_id_seq', 1, false);"
docker compose exec db psql -d ctf_db -c "SELECT setval('exfil_logs_id_seq', 1, false);"

echo "✅ Database cleaned"

# Clear Redis queue
echo "🗑️  Clearing Redis queue..."
docker compose exec redis redis-cli FLUSHALL

echo "✅ Redis cleared"

# Optionally rotate flag secret
if [ -n "$ROTATE_FLAG" ]; then
  NEW_SECRET=$(openssl rand -hex 32)
  
  # Backup old .env
  cp .env .env.backup.$(date +%s)
  
  # Update FLAG_SECRET in .env
  if grep -q "^FLAG_SECRET=" .env; then
    sed -i.bak "s/^FLAG_SECRET=.*/FLAG_SECRET=$NEW_SECRET/" .env
    rm .env.bak 2>/dev/null || true
  else
    echo "FLAG_SECRET=$NEW_SECRET" >> .env
  fi
  
  echo "🔐 FLAG_SECRET rotated (old .env backed up)"
  
  # Restart API to pick up new secret
  echo "🔄 Restarting API..."
  docker compose up -d --build api
  sleep 3
fi

echo ""
echo "✅ Challenge reset complete!"
echo ""
echo "Current status:"
docker compose exec db psql -d ctf_db -c "SELECT COUNT(*) as reports FROM reports;"
docker compose exec db psql -d ctf_db -c "SELECT COUNT(*) as exfil_logs FROM exfil_logs;"

echo ""
echo "💡 Usage:"
echo "  ./scripts/reset-challenge.sh              # Clear data only"
echo "  ./scripts/reset-challenge.sh --rotate-flag # Also rotate FLAG_SECRET"
