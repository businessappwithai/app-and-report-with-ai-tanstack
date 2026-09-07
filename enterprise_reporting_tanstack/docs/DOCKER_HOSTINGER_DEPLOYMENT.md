# Enterprise Reporting System
## Docker Deployment Guide for Hostinger VPS

This guide explains how to deploy the Enterprise Reporting System on a Hostinger VPS using Docker Compose with **bind mounts** for data persistence.

---

## 📋 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Quick Start](#quick-start)
4. [Data Storage & Bind Mounts](#data-storage--bind-mounts)
5. [Environment Configuration](#environment-configuration)
6. [Deployment Steps](#deployment-steps)
7. [Backup & Restore](#backup--restore)
8. [Monitoring & Maintenance](#monitoring--maintenance)
9. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

### Services

| Service | Container Name | Port | Purpose |
|---------|---------------|------|---------|
| **Nginx** | ers-nginx | 80, 443 | Reverse proxy with SSL |
| **Redis** | ers-redis | 6379 | Job queue backend (BullMQ) |
| **App** | ers-app | 4050 | TanStack Start application (Bun runtime) |

**Key Note**: The application uses **SQLite** (embedded database) for all data - no separate database service needed.

### Data Storage (Bind Mounts)

All data is stored on the **Hostinger VPS filesystem** at:

```
/srv/enterprise-reporting-system/
├── nginx/
│   ├── ssl/               # SSL certificates (Let's Encrypt)
│   └── conf/              # Nginx configuration
├── redis/
│   └── data/              # Redis snapshot files (for BullMQ)
├── app/
│   ├── data/              # SQLite database (config.sqlite)
│   ├── job-outputs/       # Generated reports/exports
│   ├── uploads/           # User uploaded files
│   └── logs/              # Application logs
└── backups/               # Automated backups
```

**Why Bind Mounts?**

✅ Data persists even if containers are removed
✅ Easy to backup with standard tools (rsync, tar)
✅ Compatible with Hostinger VPS snapshots
✅ No data loss during Docker updates
✅ Simple single-database approach (SQLite)

---

## Prerequisites

### Hostinger VPS Requirements

- **OS**: Ubuntu 20.04+ or Debian 11+
- **RAM**: Minimum 2GB (4GB recommended)
- **Storage**: 20GB+ SSD
- **Access**: SSH root access
- **Port 80/443**: Open for HTTP/HTTPS (for Nginx)

### Local Machine Requirements

- Docker & Docker Compose installed (for local testing)
- SSH client
- SFTP/SCP tool (for file upload)
- Bun >= 1.3.0 (for local development)

---

## Quick Start

### 1. Prepare Hostinger VPS

Upload and run the setup script:

```bash
# On your local machine
scp scripts/setup-hostinger.sh root@your-vps-ip:/root/

# SSH into your VPS
ssh root@your-vps-ip

# Make script executable and run
chmod +x setup-hostinger.sh
sudo ./setup-hostinger.sh
```

This will:
- Install Docker & Docker Compose
- Create directory structure at `/srv/enterprise-reporting-system`
- Set proper permissions

### 2. Upload Application Files

Build locally first (required for production):

```bash
# On your local machine
bun run build
```

Then upload to VPS:

```bash
# From your local machine
scp -r docker-compose.yml .env.docker.production root@your-vps-ip:/srv/enterprise-reporting-system/
scp -r .output/ vite.config.ts package.json root@your-vps-ip:/srv/enterprise-reporting-system/
scp -r src/ public/ root@your-vps-ip:/srv/enterprise-reporting-system/
```

Or use Git directly on the VPS:

```bash
# On VPS
cd /srv/enterprise-reporting-system
git clone https://your-repo-url.git .
cd /srv/enterprise-reporting-system
bun install
bun run build
```

### 3. Configure Environment

```bash
# On VPS
cd /srv/enterprise-reporting-system
cp .env.docker.production .env
nano .env  # Edit values
```

**Required changes:**

```bash
# Generate secure values
openssl rand -base64 32  # For AUTH_SECRET
openssl rand -hex 32     # For ENCRYPTION_KEY

# Update .env with:
NEXT_PUBLIC_APP_URL=https://your-domain.com
AUTH_SECRET=<generated-value>
AUTH_URL=https://your-domain.com/api/auth
REDIS_PASSWORD=<strong-password>
ENCRYPTION_KEY=<generated-value>
DATABASE_PATH=/srv/enterprise-reporting-system/data/config.sqlite
```

### 4. Run Database Migrations

```bash
# On VPS (before starting containers)
cd /srv/enterprise-reporting-system
bun install
bun run db:migrate
bun run db:sample  # Optional: load sample data
```

### 5. Start Application

```bash
# On VPS
cd /srv/enterprise-reporting-system
docker compose up -d
```

### 6. Verify Deployment

```bash
# Check containers are running
docker compose ps

# View logs
docker compose logs -f

# Check application health
curl https://your-domain.com/api/health
```

---

## Data Storage & Bind Mounts

### What's Stored Where

| VPS Path | Container Path | Contents | Backup Frequency |
|----------|---------------|----------|------------------|
| `/srv/.../redis/data` | `/data` | Redis snapshots (BullMQ) | Daily |
| `/srv/.../app/data` | `/app/data` | SQLite database | Daily |
| `/srv/.../app/uploads` | `/app/uploads` | User uploaded files | Daily |
| `/srv/.../app/job-outputs` | `/app/job-outputs` | Reports/exports | Weekly |
| `/srv/.../nginx/ssl` | `/etc/letsencrypt` | SSL certificates | Daily |

### Volume Permissions

**Redis**: Needs UID 999 (redis user)
```bash
chown -R 999:999 /srv/enterprise-reporting-system/redis
```

**App**: Needs UID 1000 (app user)
```bash
chown -R 1000:1000 /srv/enterprise-reporting-system/app
```

**Nginx**: Needs appropriate permissions
```bash
chown -R 101:101 /srv/enterprise-reporting-system/nginx
```

### Accessing Data

```bash
# Redis snapshot (for BullMQ)
ls -lh /srv/enterprise-reporting-system/redis/data/dump.rdb

# SQLite database
ls -lh /srv/enterprise-reporting-system/app/data/config.sqlite

# Generated reports and exports
ls -lh /srv/enterprise-reporting-system/app/job-outputs
```

---

## Environment Configuration

### Required Variables

```bash
# Application
NEXT_PUBLIC_APP_URL=https://your-domain.com
NODE_ENV=production

# Authentication
AUTH_SECRET=<32-char random string>
AUTH_URL=https://your-domain.com/api/auth

# Database (SQLite - embedded)
DATABASE_PATH=/srv/enterprise-reporting-system/data/config.sqlite

# Redis (for BullMQ job queue only)
REDIS_URL=redis://:your-redis-password@localhost:6379
REDIS_PASSWORD=<strong password>

# Encryption
ENCRYPTION_KEY=<32-byte hex>

# Job Processing
MAX_CONCURRENT_JOBS=5
JOB_OUTPUT_PATH=/srv/enterprise-reporting-system/job-outputs

# Pagination
DEFAULT_PAGE_SIZE=50
MAX_PAGE_SIZE=1000
DATA_TABLE_PAGE_SIZE=100

# Email (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# OpenAI (optional, for NL Query feature)
OPENAI_API_KEY=sk-...
```

### Optional Variables

```bash
# Error Reporting
NEXT_PUBLIC_ERROR_REPORTING_EMAIL=admin@example.com

# Virtual Scrolling
VIRTUAL_SCROLL_THRESHOLD=500
ENABLE_VIRTUAL_SCROLLING=true
```

---

## Deployment Steps

### Step-by-Step Guide

#### 1. SSH into VPS
```bash
ssh root@your-vps-ip
```

#### 2. Create Directory Structure
```bash
mkdir -p /srv/enterprise-reporting-system
cd /srv/enterprise-reporting-system
mkdir -p data job-outputs redis/data nginx/ssl nginx/conf
```

#### 3. Clone Repository
```bash
git clone https://your-repo-url.git .
cd /srv/enterprise-reporting-system
```

#### 4. Setup Environment
```bash
cp .env.docker.production .env
# Edit .env with your values
nano .env
```

#### 5. Build Application
```bash
# Install dependencies
bun install

# Run build
bun run build

# Run migrations
bun run db:migrate
bun run db:sample
```

#### 6. Start Services
```bash
docker compose up -d
```

#### 7. Monitor Startup
```bash
# Watch logs
docker compose logs -f

# Check health
curl https://your-domain.com/api/health
```

---

## Backup & Restore

### Automated Backup Strategy

Create a daily backup script:

```bash
#!/bin/bash
# /root/backup-enterprise-reporting.sh

BACKUP_DIR="/srv/enterprise-reporting-system/backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup-$TIMESTAMP.tar.gz"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Backup application data
tar -czf "$BACKUP_FILE" \
  /srv/enterprise-reporting-system/app/data \
  /srv/enterprise-reporting-system/app/uploads \
  /srv/enterprise-reporting-system/redis/data \
  /srv/enterprise-reporting-system/.env

echo "Backup created: $BACKUP_FILE"

# Keep only last 7 days of backups
find "$BACKUP_DIR" -name "backup-*.tar.gz" -mtime +7 -delete
```

Make it executable and add to cron:

```bash
chmod +x /root/backup-enterprise-reporting.sh

# Add to crontab (runs daily at 2 AM)
crontab -e
# Add line: 0 2 * * * /root/backup-enterprise-reporting.sh
```

### Manual Backup

```bash
# Backup everything
cd /srv/enterprise-reporting-system
tar -czf enterprise-reporting-backup-$(date +%Y%m%d).tar.gz \
  app/data redis/data .env

# Download to local machine
scp root@your-vps-ip:/srv/enterprise-reporting-system/enterprise-reporting-backup-*.tar.gz ./
```

### Restore from Backup

```bash
# Stop containers
docker compose down

# Extract backup
cd /srv/enterprise-reporting-system
tar -xzf enterprise-reporting-backup-20240501.tar.gz

# Restore permissions
chown -R 1000:1000 app
chown -R 999:999 redis

# Start containers
docker compose up -d
```

---

## Monitoring & Maintenance

### Health Checks

```bash
# Check API health
curl https://your-domain.com/api/health

# Check container status
docker compose ps

# View application logs
docker compose logs -f app

# Monitor Redis
docker compose exec redis redis-cli info
```

### Database Maintenance

```bash
# Run database migrations
docker compose exec app bun run db:migrate

# View database
docker compose exec app sqlite3 data/config.sqlite "SELECT name FROM sqlite_master WHERE type='table';"
```

### Job Queue Management

```bash
# View job queue status
docker compose exec app curl http://localhost:4050/bull-board

# Restart jobs worker if needed
docker compose restart app
```

### Update Application

```bash
# Pull latest code
cd /srv/enterprise-reporting-system
git pull origin main

# Build new version
bun install
bun run build

# Rebuild and restart container
docker compose up -d --build app
```

---

## Troubleshooting

### Container Won't Start

```bash
# View detailed logs
docker compose logs app

# Common issues:
# - PORT 4050 already in use
# - Database file permissions
# - Redis connection refused
```

### Database Connection Error

```bash
# Check database file exists
ls -lh /srv/enterprise-reporting-system/app/data/config.sqlite

# Check permissions
chown -R 1000:1000 /srv/enterprise-reporting-system/app/data

# Restart container
docker compose restart app
```

### Redis Connection Error

```bash
# Check Redis is running
docker compose ps redis

# Check Redis connectivity
docker compose exec redis redis-cli ping

# Rebuild Redis container
docker compose down redis
docker compose up -d redis
```

### Storage Full

```bash
# Check disk usage
df -h

# Clean up old exports
rm -f /srv/enterprise-reporting-system/app/job-outputs/*.{csv,xlsx,pdf}

# Clean up Docker
docker compose down
docker system prune
```

### SSL/Certificate Issues

```bash
# Renew Let's Encrypt certificate
docker compose exec nginx certbot renew

# Manual certificate request
docker compose exec nginx certbot certonly --webroot -w /usr/share/nginx/html \
  -d your-domain.com
```

---

## Performance Tips

### Optimize for Hostinger VPS

1. **Enable Virtual Scrolling**: Set `ENABLE_VIRTUAL_SCROLLING=true`
2. **Reduce Page Size**: Set `DEFAULT_PAGE_SIZE=25` for slower connections
3. **Enable Compression**: Nginx gzip already enabled
4. **Monitor Memory**: Use `docker stats` to monitor container memory
5. **Clean Up Jobs**: Archive old job outputs monthly

### Memory Optimization

```bash
# Monitor container memory
docker compose stats

# If memory usage is high:
docker compose down
docker volume prune
docker compose up -d
```

---

## Support & Documentation

- **Project Docs**: See [docs/](../docs/) directory
- **Architecture**: See [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)
- **Testing**: See [docs/TESTING.md](../docs/TESTING.md)
- **Features**: See [docs/FEATURES.md](../docs/FEATURES.md)
- **Developer Guide**: See [CLAUDE.md](../CLAUDE.md)

---

**Built with Bun, TanStack Start, SQLite, and BullMQ for enterprise-grade reporting.**
