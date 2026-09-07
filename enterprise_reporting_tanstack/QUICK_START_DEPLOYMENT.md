# Quick Start: Deploy to Hostinger in 5 Minutes

## TL;DR for experienced DevOps

### Prerequisites
- Hostinger VPS with Docker + Docker Compose
- SSH access to root
- MariaDB dump: `/tmp/enterprise_config_backup.sql`

### Deploy
```bash
# 1. Export database
mysqldump -h 127.0.0.1 -P 3307 -u enterprise -penterprise_pass enterprise_config > \
  /tmp/enterprise_config_backup.sql

# 2. Run automated deployment
./scripts/deploy-hostinger.sh YOUR_HOSTINGER_IP root 22

# 3. Configure
ssh root@YOUR_HOSTINGER_IP
cd /root/ers
nano .env
# Update: NEXT_PUBLIC_APP_URL, AUTH_URL, AI_NL2SQL_API_KEY

# 4. Restart
docker compose -f docker-compose.remote.yml restart

# 5. Test
./scripts/test-remote-deployment.sh YOUR_HOSTINGER_IP root 22
```

---

## Step-by-Step Manual Deployment

### 1️⃣ Prepare Files (2 minutes)

#### On Your Local Machine:

```bash
cd /path/to/enterprise_reporting_tanstack

# Export database
mysqldump -h 127.0.0.1 -P 3307 -u enterprise -penterprise_pass enterprise_config > \
  /tmp/enterprise_config_backup.sql

# Verify export
wc -l /tmp/enterprise_config_backup.sql  # Should be >100 lines
```

### 2️⃣ Transfer to Hostinger (3 minutes)

```bash
# Set variables
HOSTINGER_IP="192.168.1.100"  # Your actual IP
HOSTINGER_USER="root"

# Create directory on Hostinger
ssh $HOSTINGER_USER@$HOSTINGER_IP "mkdir -p /root/ers"

# Sync entire project
rsync -avz --exclude=node_modules --exclude=.next --exclude=.docker-data \
  ./ $HOSTINGER_USER@$HOSTINGER_IP:/root/ers/

# Copy database dump
scp /tmp/enterprise_config_backup.sql \
  $HOSTINGER_USER@$HOSTINGER_IP:/root/ers/

# Verify
ssh $HOSTINGER_USER@$HOSTINGER_IP "ls -lh /root/ers/"
```

### 3️⃣ Deploy Containers (5 minutes + build time)

```bash
# SSH into Hostinger
ssh root@$HOSTINGER_IP

# Navigate to project
cd /root/ers

# Create .env file
cp .env.remote.example .env
nano .env  # Edit with your values

# Key fields to update:
# NEXT_PUBLIC_APP_URL=https://your-domain.com  (or http://IP:3000)
# AUTH_URL=https://your-domain.com
# AI_NL2SQL_API_KEY=your-actual-key

# Start containers
docker compose -f docker-compose.remote.yml up -d --build

# Wait for build (5-15 minutes depending on internet speed)
docker compose -f docker-compose.remote.yml logs -f

# Once you see "healthy" status, press Ctrl+C
```

### 4️⃣ Import Database (1 minute)

```bash
# Still in /root/ers on Hostinger

# Import database dump
docker exec ers-remote-mariadb mysql -u enterprise -penterprise_pass \
  enterprise_config < enterprise_config_backup.sql

# Verify import
docker exec ers-remote-mariadb mysql -u enterprise -penterprise_pass \
  enterprise_config -e "SHOW TABLES;" | wc -l

# Should show ~15-20 tables
```

### 5️⃣ Test Deployment (2 minutes)

```bash
# From your local machine
./scripts/test-remote-deployment.sh $HOSTINGER_IP root 22

# Expected output: ✓ All tests passed!
```

### 6️⃣ Access Application

Open in browser:
- **Application**: `http://YOUR_HOSTINGER_IP:3000`
- **Mastra Studio**: `http://YOUR_HOSTINGER_IP:4111`

---

## Verification Commands

### Check Container Status
```bash
docker ps | grep ers-remote

# Expected output:
# ers-remote-mariadb    mariadb:11           (healthy)
# ers-remote-redis      redis:7-alpine       (healthy)
# ers-remote-stt        ers-stt:latest       (healthy)
# ers-remote-mastra     ers-mastra:latest    (healthy)
# ers-remote-app        enterprise-...:latest (healthy)
```

### Test Key Services

```bash
# Database
docker exec ers-remote-mariadb mysql -u enterprise -penterprise_pass \
  enterprise_config -e "SELECT VERSION();"

# Redis
docker exec ers-remote-redis redis-cli ping
# Expected: PONG

# STT
curl http://localhost:8081/health

# Mastra
curl http://localhost:4111/health

# App API
curl http://localhost:3000/api/health
```

### View Logs

```bash
# All services
docker compose -f docker-compose.remote.yml logs -f --tail=50

# Specific service
docker logs -f ers-remote-app
docker logs -f ers-remote-mastra
```

### Monitor Resources

```bash
# Real-time monitoring
docker stats

# Disk space
df -h /root/ers

# CPU & Memory
free -h
top
```

---

## Configuration Files

### Environment Variables (.env)

**Copy from** `.env.remote.example` and customize:

```env
# Security
AUTH_SECRET=<keep from local or generate new>
ENCRYPTION_KEY=<keep from local or generate new>

# URLs (CRITICAL - update these!)
NEXT_PUBLIC_APP_URL=https://your-domain.com
AUTH_URL=https://your-domain.com

# Database (keep these as-is to match exported dump)
MARIADB_ROOT_PASSWORD=root_pass
MARIADB_DATABASE=enterprise_config
MARIADB_USER=enterprise
MARIADB_PASSWORD=enterprise_pass

# AI Provider
AI_NL2SQL_API_KEY=your-openrouter-key

# Cache
REDIS_PASSWORD=redis_pass
```

---

## Troubleshooting Quick Fixes

### Container won't start
```bash
# Check logs
docker logs ers-remote-app

# Check ports not in use
netstat -tlnp | grep 3000
netstat -tlnp | grep 3306

# Free port (if needed)
sudo fuser -k 3000/tcp
```

### Database errors
```bash
# Verify import
docker exec ers-remote-mariadb mysql -u enterprise -penterprise_pass \
  enterprise_config -e "SHOW TABLES;" | head

# Check table structure
docker exec ers-remote-mariadb mysql -u enterprise -penterprise_pass \
  enterprise_config -e "DESC adk_intents;" | head

# Re-import if needed
docker exec ers-remote-mariadb mysql -u enterprise -penterprise_pass \
  enterprise_config < enterprise_config_backup.sql
```

### App can't connect to services
```bash
# Check network connectivity from app
docker exec ers-remote-app ping mariadb
docker exec ers-remote-app redis-cli -h redis ping
docker exec ers-remote-app curl http://mastra:4111/health

# Check DNS inside container
docker exec ers-remote-app nslookup mariadb
```

### Disk space issues
```bash
# Check usage
du -sh .docker-data/*

# Clean up old images (careful!)
docker image prune -a --force

# Clean up unused volumes
docker volume prune
```

---

## What's Running

| Service | Port | Purpose |
|---------|------|---------|
| **App** | 3000 | Main TanStack application |
| **MariaDB** | 3306 | Configuration database |
| **Redis** | 6379 | Job queue & caching |
| **STT** | 8081 | Speech-to-Text (whisper.cpp) |
| **Mastra** | 4111 | AI agent server (NL-to-SQL) |

---

## Next Steps

1. **SSL Certificate** (for production):
   ```bash
   apt-get install -y nginx certbot python3-certbot-nginx
   certbot --nginx -d your-domain.com
   ```

2. **Automated Backups**:
   ```bash
   # Add to crontab
   0 2 * * * docker exec ers-remote-mariadb mysqldump -u enterprise \
     -penterprise_pass enterprise_config > /root/ers/backups/db_backup_$(date +\%Y\%m\%d).sql
   ```

3. **Monitoring**:
   - Set up log aggregation
   - Configure uptime monitoring
   - Set up alerting for container crashes

---

## Rollback

If something goes wrong:

```bash
# Stop containers
docker compose -f docker-compose.remote.yml down

# Restore database backup
docker exec ers-remote-mariadb mysql -u enterprise -penterprise_pass \
  enterprise_config < enterprise_config_backup.sql

# Restart
docker compose -f docker-compose.remote.yml up -d

# Check status
docker ps
```

---

## Support

- **Full guide**: See `DEPLOYMENT_GUIDE.md`
- **Checklist**: See `DEPLOYMENT_CHECKLIST.md`
- **Testing**: Run `./scripts/test-remote-deployment.sh`
- **Logs**: `docker compose -f docker-compose.remote.yml logs`

---

⏱️ **Total Time**: ~15-20 minutes (including container builds and initial startup)
