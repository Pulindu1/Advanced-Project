#!/bin/sh
set -e

# Start Redis server in the background
redis-server --daemonize yes --protected-mode no

# Wait for Redis to be ready
until redis-cli ping | grep -q PONG; do
  sleep 1
done

echo "Seeding Redis with initial data..."

redis-cli SET "veridian:session:admin" "vsec-admin-sess-a1b2c3d4e5f6"

redis-cli SET "veridian:incident:2024-03-15" "SUPPRESSED INCIDENT FRAGMENT: Analyst Marsh was in possession of evidence documenting unauthorised surveillance operations. His death on 15 March 2024 occurred three days before his scheduled disclosure to the ICO. Case files sealed by executive order."

redis-cli SET "veridian:flag3" "__FLAG3_PLACEHOLDER__"

echo "Redis seed data loaded."

# Stop the background Redis and start it in the foreground
redis-cli shutdown nosave
exec redis-server --protected-mode no
