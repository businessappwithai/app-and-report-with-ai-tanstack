#!/bin/bash

# stop.sh - Stop the Enterprise Reporting System development server
# Powered by Bun

PORT=${1:-4050}

echo "=========================================="
echo "Enterprise Reporting System - Stop"
echo "Powered by Bun"
echo "=========================================="
echo ""

# Check if server is running
if ! lsof -ti:$PORT > /dev/null 2>&1; then
    echo "ℹ️  No server is running on port $PORT"
    exit 0
fi

echo "Stopping development server on port $PORT..."

# Kill process on the specified port
lsof -ti:$PORT | xargs kill -9 2>/dev/null

echo "✓ Server stopped"
echo ""
echo "To start the server again, run:"
echo "  ./start.sh"
