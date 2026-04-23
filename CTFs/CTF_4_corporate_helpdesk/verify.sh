#!/bin/bash

# Verification script for CTF setup

echo "🔍 Verifying CTF setup..."
echo ""

# Check directory structure
echo "📁 Checking directory structure..."
dirs=("apps/api" "apps/web" "apps/bot" "infra")
for dir in "${dirs[@]}"; do
    if [ -d "$dir" ]; then
        echo "  ✅ $dir exists"
    else
        echo "  ❌ $dir missing"
    fi
done
echo ""

# Check key files
echo "📄 Checking key files..."
files=(
    "docker-compose.yml"
    ".env"
    "README.md"
    "apps/api/package.json"
    "apps/api/src/index.ts"
    "apps/web/package.json"
    "apps/web/src/App.tsx"
    "apps/bot/package.json"
    "apps/bot/src/index.ts"
    "infra/init.sql"
)
for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✅ $file exists"
    else
        echo "  ❌ $file missing"
    fi
done
echo ""

# Check page components
echo "🎨 Checking page components..."
pages=(
    "apps/web/src/pages/Login.tsx"
    "apps/web/src/pages/Register.tsx"
    "apps/web/src/pages/Dashboard.tsx"
    "apps/web/src/pages/KnowledgeBase.tsx"
    "apps/web/src/pages/KBArticle.tsx"
    "apps/web/src/pages/Report.tsx"
)
for page in "${pages[@]}"; do
    if [ -f "$page" ]; then
        echo "  ✅ $(basename $page)"
    else
        echo "  ❌ $(basename $page) missing"
    fi
done
echo ""

# Check if Docker is running
echo "🐳 Checking Docker..."
if docker info > /dev/null 2>&1; then
    echo "  ✅ Docker is running"
else
    echo "  ❌ Docker is not running"
fi
echo ""

# Check if ports are available
echo "🔌 Checking ports..."
ports=(5176 4001 5433 6380)
port_names=("Frontend" "API" "PostgreSQL" "Redis")
for i in "${!ports[@]}"; do
    port="${ports[$i]}"
    name="${port_names[$i]}"
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "  ⚠️  Port $port ($name) is in use"
    else
        echo "  ✅ Port $port ($name) is available"
    fi
done
echo ""

# Summary
echo "✨ Verification complete!"
echo ""
echo "To start the CTF:"
echo "  docker compose up --build"
echo ""
echo "Then access:"
echo "  Frontend: http://localhost:5176"
echo "  API:      http://localhost:4001"
echo ""
