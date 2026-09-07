# Remote Hostinger Deployment Guide

This guide walks through deploying the Enterprise Reporting System to a remote Hostinger server with the exact MariaDB configuration from your local environment.

## Prerequisites

- Hostinger VPS with Docker and Docker Compose installed
- SSH access to your Hostinger server
- ~20GB free disk space (for containers, databases, volumes)
- Domain name (optional, but recommended for production)

## Step 1: Prepare Deployment Files

### On Your Local Machine

1. **Database Export** (already done):
   ```bash
   # Database dump is at: /tmp/enterprise_config_backup.sql
   # Compressed: /tmp/enterprise_config_backup.sql.gz
   ```

2. **Copy deployment files to Hostinger**:
   ```bash
   # Replace YOUR_HOSTINGER_IP with actual IP
   scp docker-compose.remote.yml root@YOUR_HOSTINGER_IP:/root/ers/
   scp .env.remote.example root@YOUR_HOSTINGER_IP:/root/ers/.env
   scp Dockerfile root@YOUR_HOSTINGER_IP:/root/ers/
   scp Dockerfile.mastra root@YOUR_HOSTINGER_IP:/root/ers/
   scp Dockerfile.stt root@YOUR_HOSTINGER_IP:/root/ers/
   scp -r mastra root@YOUR_HOSTINGER_IP:/root/ers/
   scp package.json bun.lock root@YOUR_HOSTINGER_IP:/root/ers/
   scp -r src root@YOUR_HOSTINGER_IP:/root/ers/
   scp enterprise_config_backup.sql root@YOUR_HOSTINGER_IP:/root/ers/
   ```

   Or use a single command:
   ```bash
   rsync -avz --exclude=node_modules --exclude=.docker-data --exclude=.next \
     ./ root@YOUR_HOSTINGER_IP:/root/ers/
   ```

## Step 2: Configure Environment on Hostinger

1. **SSH into your Hostinger server**:
   ```bash
   ssh root@YOUR_HOSTINGER_IP
   cd /root/ers
   ```

2. **Edit `.env` file with your remote configuration**:
   ```bash
   nano .env
   ```

   **Critical Fields to Update**:
   - `NEXT_PUBLIC_APP_URL` → Your domain or `http://YOUR_HOSTINGER_IP:3000`
   - `AUTH_URL` → Same as above
   - `AUTH_SECRET` → Keep as-is (same as local) OR generate a new one for production
   - `ENCRYPTION_KEY` → Keep as-is (same as local) OR generate a new one for production
   - `AI_NL2SQL_API_KEY` → Your OpenRouter API key
   - `ERROR_REPORTING_EMAIL` → Admin email

   **Database Credentials** (keep same as local to ensure compatibility):
   - `MARIADB_ROOT_PASSWORD=root_pass`
   - `MARIADB_DATABASE=enterprise_config`
   - `MARIADB_USER=enterprise`
   - `MARIADB_PASSWORD=enterprise_pass`

## Step 3: Deploy Containers

1. **Start all services** (builds will happen automatically):
   ```bash
   cd /root/ers
   docker compose -f docker-compose.remote.yml up -d --build
   ```

   This will:
   - Build the app container (TanStack Start)
   - Build the Mastra agent server
   - Build the STT (whisper.cpp) service
   - Pull MariaDB 11 image
   - Pull Redis image
   - Start all containers with health checks

2. **Monitor startup** (takes 2-5 minutes):
   ```bash
   docker compose -f docker-compose.remote.yml logs -f
   
   # Or check individual services:
   docker ps
   ```

   Expected healthy services:
   ```
   ers-remote-mariadb   mariadb:11           (healthy)
   ers-remote-redis     redis:7-alpine       (healthy)
   ers-remote-stt       ers-stt:latest       (healthy)
   ers-remote-mastra    ers-mastra:latest    (healthy)
   ers-remote-app       enterprise-...:latest (healthy)
   ```

## Step 4: Import Local Database

The MariaDB container starts with an empty `enterprise_config` database. Import the local backup:

```bash
# Option 1: Import directly from SQL file
docker exec ers-remote-mariadb mysql -u enterprise -penterprise_pass enterprise_config < \
  /root/ers/enterprise_config_backup.sql

# Option 2: Copy SQL file into container and import
docker cp enterprise_config_backup.sql ers-remote-mariadb:/tmp/
docker exec ers-remote-mariadb mysql -u enterprise -penterprise_pass enterprise_config < /tmp/enterprise_config_backup.sql

# Verify import
docker exec ers-remote-mariadb mysql -u enterprise -penterprise_pass enterprise_config -e "SHOW TABLES;"
```

Expected tables: `adk_intents`, `adk_entity_slots`, `data_sources`, `entities`, etc.

## Step 5: Test Remote Deployment

### 1. Application Health

```bash
# Check app container logs
docker logs ers-remote-app

# Health endpoint
curl http://YOUR_HOSTINGER_IP:3000/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-06-06T..."
}
```

### 2. Database Connectivity

```bash
# From Hostinger server, verify MariaDB is accessible
docker exec ers-remote-app curl -s http://mariadb:3306 | head -c 50

# Or test with a query through the app
curl -X GET "http://YOUR_HOSTINGER_IP:3000/api/data-sources" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3. Mastra Agent Server

```bash
# Check Mastra health
curl http://YOUR_HOSTINGER_IP:4111/health

# Expected: {"status": "ok"}
```

### 4. STT Service

```bash
# Check STT health
curl http://YOUR_HOSTINGER_IP:8081/health
```

### 5. Redis

```bash
# Verify Redis is accepting connections
docker exec ers-remote-redis redis-cli ping
# Expected: PONG
```

### 6. Access Web Application

Open your browser to:
- **App**: `http://YOUR_HOSTINGER_IP:3000` or `https://your-domain.com`
- **Mastra Studio** (if exposed): `http://YOUR_HOSTINGER_IP:4111`

### 7. Test Full NL-to-SQL Pipeline

1. Login to the app
2. Navigate to `/nl-query` page
3. Submit a natural language query
4. Verify:
   - Query is sent to Mastra server
   - Mastra processes and generates SQL
   - Results are returned and displayed

## Step 6: Nginx Reverse Proxy (Optional but Recommended)

To run on port 80/443 and use your domain:

```bash
# Install Nginx on Hostinger
apt-get update && apt-get install -y nginx certbot python3-certbot-nginx

# Create Nginx config
cat > /etc/nginx/sites-available/ers << 'EOF'
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# Enable site
ln -s /etc/nginx/sites-available/ers /etc/nginx/sites-enabled/
nginx -t && systemctl restart nginx

# Get SSL certificate
certbot --nginx -d your-domain.com
```

## Troubleshooting

### Containers Not Starting

```bash
# Check logs
docker compose -f docker-compose.remote.yml logs

# Check specific service
docker logs ers-remote-app
docker logs ers-remote-mastra
```

### Database Connection Errors

```bash
# Verify MariaDB container is running and healthy
docker ps | grep mariadb

# Check if database tables exist
docker exec ers-remote-mariadb mysql -u enterprise -penterprise_pass enterprise_config -e "SELECT COUNT(*) as table_count FROM information_schema.TABLES WHERE table_schema='enterprise_config';"

# If tables missing, re-import dump
docker exec ers-remote-mariadb mysql -u enterprise -penterprise_pass enterprise_config < enterprise_config_backup.sql
```

### App Can't Connect to Mastra

```bash
# Verify Mastra is running
docker ps | grep mastra

# Check Mastra logs
docker logs ers-remote-mastra

# Test Mastra endpoint from app container
docker exec ers-remote-app curl http://mastra:4111/health
```

### High Memory/CPU Usage

```bash
# Monitor container resource usage
docker stats

# Adjust resource limits in docker-compose.remote.yml if needed
```

## Monitoring & Maintenance

### View Logs

```bash
# Real-time logs
docker compose -f docker-compose.remote.yml logs -f

# Specific service
docker logs -f ers-remote-app
docker logs -f ers-remote-mastra
```

### Backup Database

```bash
# Backup MariaDB
docker exec ers-remote-mariadb mysqldump -u enterprise -penterprise_pass enterprise_config > \
  /root/ers/backups/enterprise_config_$(date +%Y%m%d_%H%M%S).sql

# Backup volumes
tar czf /root/ers/backups/docker_data_$(date +%Y%m%d_%H%M%S).tar.gz .docker-data/
```

### Update Containers

```bash
# Pull latest images and rebuild
docker compose -f docker-compose.remote.yml pull
docker compose -f docker-compose.remote.yml up -d --build
```

### Stop/Restart Services

```bash
# Stop all
docker compose -f docker-compose.remote.yml down

# Start all
docker compose -f docker-compose.remote.yml up -d

# Restart specific service
docker compose -f docker-compose.remote.yml restart app
```

## Next Steps

1. ✅ Verify all containers are healthy and accessible
2. ✅ Test NL-to-SQL pipeline end-to-end
3. ✅ Configure Nginx and SSL certificate (optional)
4. ✅ Set up automated database backups
5. ✅ Monitor logs and resource usage
6. ✅ Document any custom configurations specific to Hostinger

## Support

For issues or questions:
- Check container logs: `docker logs <container_name>`
- Review docker-compose.remote.yml for service definitions
- Ensure all environment variables are set correctly in .env
