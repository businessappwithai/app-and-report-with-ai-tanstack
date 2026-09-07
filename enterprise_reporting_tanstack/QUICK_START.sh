#!/bin/bash
# Quick Start Script - Enterprise Reporting System Docker Setup

set -e

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  Enterprise Reporting System - Docker Quick Start             ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Step 1: Check Docker
echo "📦 Step 1: Checking Docker..."
if docker info &> /dev/null; then
    echo "✅ Docker is running"
else
    echo "❌ Docker is not running"
    echo ""
    echo "Start Docker Desktop:"
    echo "  macOS: ! open -a Docker"
    echo ""
    echo "Then run this script again."
    exit 1
fi
echo ""

# Step 2: Build
echo "🔨 Step 2: Building Docker image..."
echo "   (This takes 5-15 minutes on first build)"
echo ""
./rebuildDocker.sh
echo ""

# Step 3: Start
echo "🚀 Step 3: Starting containers..."
echo ""
./startDocker.sh
echo ""

# Step 4: Status
echo "📊 Step 4: Container Status"
echo ""
docker compose -f docker-compose.local.yml ps
echo ""

# Step 5: Summary
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  ✨ Setup Complete!                                           ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "🌐 Access Application:"
echo "   URL:      http://localhost:4050"
echo "   Email:    admin@admin.com"
echo "   Password: admin"
echo ""
echo "📊 Services:"
echo "   • App:     http://localhost:4050"
echo "   • MariaDB: localhost:3307"
echo "   • Redis:   localhost:6380"
echo ""
echo "📝 Useful Commands:"
echo "   View logs:   docker compose -f docker-compose.local.yml logs -f app"
echo "   Stop:        ./stopDocker.sh"
echo "   Restart:     ./stopDocker.sh && ./startDocker.sh"
echo "   Rebuild:     ./rebuildDocker.sh && ./startDocker.sh"
echo ""
echo "📚 Documentation:"
echo "   Build Guide:  DOCKER_BUILD_GUIDE.md"
echo "   Full Summary: DOCKER_SETUP_SUMMARY.md"
echo ""
