#!/bin/bash
# ==========================================
# Enterprise Reporting System
# Automated Backup Script for Hostinger
# ==========================================
# This script creates automated backups of:
# - SQLite configuration database
# - Redis data
# - Application data (uploads, job outputs)
#
# Setup:
#   1. Copy this script to /usr/local/bin/ers-backup.sh
#   2. Make it executable: chmod +x /usr/local/bin/ers-backup.sh
#   3. Add to crontab: crontab -e
#      Example: Daily backup at 2 AM
#      0 2 * * * /usr/local/bin/ers-backup.sh
# ==========================================

set -e

# Configuration
DATA_PATH="/srv/enterprise-reporting-system"
BACKUP_PATH="${DATA_PATH}/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Create backup directory
mkdir -p "${BACKUP_PATH}/${TIMESTAMP}"

echo "Starting backup at $(date)"

# 1. Backup SQLite database (safe copy while app is running)
echo "Backing up SQLite database..."
if [ -f "${DATA_PATH}/app/data/config.sqlite" ]; then
    # Use sqlite3 .backup for a consistent snapshot, fall back to cp
    docker exec ers-app sh -c 'sqlite3 /app/data/config.sqlite ".backup /tmp/config-backup.sqlite"' 2>/dev/null && \
        docker cp ers-app:/tmp/config-backup.sqlite "${BACKUP_PATH}/${TIMESTAMP}/config.sqlite" || \
        cp "${DATA_PATH}/app/data/config.sqlite" "${BACKUP_PATH}/${TIMESTAMP}/config.sqlite"
    gzip "${BACKUP_PATH}/${TIMESTAMP}/config.sqlite"
    echo "SQLite backup complete"
else
    echo "No SQLite database found, skipping..."
fi

# 2. Backup Redis (create snapshot)
echo "Backing up Redis..."
docker exec ers-redis redis-cli SAVE 2>/dev/null || true
if [ -f "${DATA_PATH}/redis/data/dump.rdb" ]; then
    cp "${DATA_PATH}/redis/data/dump.rdb" "${BACKUP_PATH}/${TIMESTAMP}/redis.rdb"
    gzip "${BACKUP_PATH}/${TIMESTAMP}/redis.rdb"
fi

# 3. Backup application data
echo "Backing up application data..."
tar -czf "${BACKUP_PATH}/${TIMESTAMP}/app-data.tar.gz" -C "${DATA_PATH}/app" data 2>/dev/null || true

# 4. Backup uploads
echo "Backing up uploads..."
tar -czf "${BACKUP_PATH}/${TIMESTAMP}/uploads.tar.gz" -C "${DATA_PATH}/app" uploads 2>/dev/null || true

# 5. Backup job outputs
echo "Backing up job outputs..."
tar -czf "${BACKUP_PATH}/${TIMESTAMP}/job-outputs.tar.gz" -C "${DATA_PATH}/app" job-outputs 2>/dev/null || true

# Create backup manifest
cat > "${BACKUP_PATH}/${TIMESTAMP}/manifest.txt" <<EOF
Backup created: $(date)
System: Enterprise Reporting System
Components:
  - SQLite configuration database
  - Redis data snapshot
  - Application data
  - User uploads
  - Job outputs
EOF

echo "Backup completed: ${BACKUP_PATH}/${TIMESTAMP}"

# Clean old backups (keep last N days)
echo "Cleaning old backups (older than ${RETENTION_DAYS} days)..."
find "${BACKUP_PATH}" -maxdepth 1 -type d -mtime +${RETENTION_DAYS} -exec rm -rf {} \;

echo "Backup process finished at $(date)"
echo "Disk usage:"
du -sh "${BACKUP_PATH}"/* 2>/dev/null | tail -5
