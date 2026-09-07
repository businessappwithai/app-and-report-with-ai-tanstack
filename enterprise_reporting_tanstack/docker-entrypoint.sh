#!/bin/sh
set -e

echo "========================================"
echo "Enterprise Reporting System - Entrypoint"
echo "Starting with Node.js for native module compatibility"
echo "========================================"

ensure_directories() {
  mkdir -p /app/data /app/uploads /app/job-outputs /app/logs /app/data/uploads
}

# Ensure required directories exist
ensure_directories

# Note: Migrations are run during the build process in the builder stage
# At runtime, we use Node.js to load native modules (better-sqlite3)
# Bun runtime doesn't support native Node.js modules

echo "Starting application..."
echo "========================================"

# Use Node.js instead of Bun to load native modules
exec su-exec bunuser:bunuser node server.js
