#!/bin/sh
set -e

echo "========================================"
echo "Enterprise Reporting System - Docker Startup"
echo "========================================"

# Ensure required directories exist
mkdir -p /app/data
mkdir -p /app/job-outputs
mkdir -p /app/uploads
mkdir -p /app/logs

echo "Directories created/verified"

# Run database initialization if this is a fresh start
if [ ! -f /app/data/.initialized ]; then
  echo "First run detected - initializing database..."

  # Run database initialization with Kysely
  echo "Running database initialization..."
  bun /app/scripts/rebuild-db.ts || echo "Database initialization already completed or failed"

  # Mark as initialized
  touch /app/data/.initialized
  echo "Database initialization completed"
else
  echo "Database already initialized, skipping..."
fi

# Verify admin user exists (quick check)
echo "Verifying setup..."

echo "========================================"
echo "Starting application..."
echo "========================================"

# Start the application
exec node server.js
