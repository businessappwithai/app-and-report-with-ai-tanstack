#!/bin/bash
# ==========================================
# Enterprise Reporting System
# Deploy to Hostinger VPS (Local Build)
# ==========================================
# This script builds the Docker image locally,
# uploads it to the VPS, and starts the containers
# with Nginx reverse proxy and optional SSL.
#
# The script will also upload the local database
# from data/config.sqlite if it exists.
#
# Usage:
#   chmod +x deploy-to-hostinger.sh
#   ./deploy-to-hostinger.sh root@148.135.137.110
#
# First-time SSL setup (after deploy):
#   ./deploy-to-hostinger.sh root@148.135.137.110 --setup-ssl your-domain.com admin@email.com
# ==========================================

set -e

# Configuration
# Parse user@host if provided as single argument, or use separate arguments
if [[ "$1" == *@* ]]; then
  VPS_USER="${1%@*}"
  VPS_HOST="${1#*@}"
else
  VPS_USER="${1:-root}"
  VPS_HOST="${2:-148.135.137.110}"
fi
VPS_PATH="/srv/enterprise-reporting-system"
APP_NAME="enterprise-reporting-system"
IMAGE_NAME="${APP_NAME}:latest"
TEMP_IMAGE="/tmp/${APP_NAME}-deploy.tar.gz"
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SETUP_SSL=false
DOMAIN=""
SSL_EMAIL=""

# Parse optional flags
shift 2>/dev/null || shift 1 2>/dev/null || true
while [[ $# -gt 0 ]]; do
  case $1 in
    --setup-ssl)
      SETUP_SSL=true
      DOMAIN="${2}"
      SSL_EMAIL="${3}"
      shift 3
      ;;
    *)
      shift
      ;;
  esac
done

echo "========================================"
echo "  Deploying ${APP_NAME}"
echo "  to Hostinger VPS"
echo "========================================"
echo "  Host: ${VPS_HOST}"
echo "  Path: ${VPS_PATH}"
echo ""

# Check if we can connect
echo "[1/7] Testing connection to VPS..."
ssh -o ConnectTimeout=10 ${VPS_USER}@${VPS_HOST} "echo 'Connection successful'" || {
    echo "FAILED: Cannot connect to VPS"
    echo "  Make sure SSH key is configured."
    exit 1
}

# Step 1: Build Docker image locally
echo ""
echo "[2/7] Building Docker image locally for AMD64..."
docker buildx build --platform linux/amd64 -t ${IMAGE_NAME} --load "${SCRIPT_DIR}" || {
    echo "FAILED: Docker build error"
    exit 1
}
echo "Build complete!"

# Step 2: Save Docker image
echo ""
echo "[3/7] Saving Docker image..."
docker save ${IMAGE_NAME} | gzip > ${TEMP_IMAGE}
echo "Image saved to ${TEMP_IMAGE}"
ls -lh ${TEMP_IMAGE}

# Step 3: Upload to VPS
echo ""
echo "[4/7] Uploading Docker image to VPS..."
scp ${TEMP_IMAGE} ${VPS_USER}@${VPS_HOST}:/tmp/
echo "Upload complete!"

# Step 4: Upload config files
echo ""
echo "[5/8] Uploading configuration files..."
scp "${SCRIPT_DIR}/docker-compose.yml" ${VPS_USER}@${VPS_HOST}:${VPS_PATH}/
scp "${SCRIPT_DIR}/.env.docker.production" ${VPS_USER}@${VPS_HOST}:${VPS_PATH}/
scp "${SCRIPT_DIR}/scripts/backup-hostinger.sh" ${VPS_USER}@${VPS_HOST}:${VPS_PATH}/
echo "Config files uploaded!"

# Step 5: Upload local database
echo ""
echo "[6/8] Uploading local database..."
if [ -f "${SCRIPT_DIR}/data/config.sqlite" ]; then
    ssh ${VPS_USER}@${VPS_HOST} "mkdir -p ${VPS_PATH}/app/data"
    scp "${SCRIPT_DIR}/data/config.sqlite" ${VPS_USER}@${VPS_HOST}:${VPS_PATH}/app/data/
    echo "Database uploaded!"
else
    echo "  Warning: No local database found at ${SCRIPT_DIR}/data/config.sqlite"
    echo "  Using database from Docker image instead..."
fi

# Step 6: Upload Nginx config
echo ""
echo "[7/8] Uploading Nginx configuration..."
ssh ${VPS_USER}@${VPS_HOST} "mkdir -p ${VPS_PATH}/nginx"
scp "${SCRIPT_DIR}/nginx/default.conf" ${VPS_USER}@${VPS_HOST}:${VPS_PATH}/nginx/
scp "${SCRIPT_DIR}/nginx/default-http-only.conf" ${VPS_USER}@${VPS_HOST}:${VPS_PATH}/nginx/
echo "Nginx config uploaded!"

# Step 7: Deploy on VPS
echo ""
echo "[8/8] Deploying on VPS..."
ssh ${VPS_USER}@${VPS_HOST} << DEPLOY_EOF
set -e

echo "  Creating data directories..."
mkdir -p ${VPS_PATH}/{redis/data,app/{data,job-outputs,uploads,logs},nginx/conf.d,certbot/{conf,www},backups}

echo "  Fixing permissions..."
chown -R 999:999 ${VPS_PATH}/redis 2>/dev/null || true
chown -R 1001:1000 ${VPS_PATH}/app 2>/dev/null || true

echo "  Loading Docker image..."
docker load < /tmp/${APP_NAME}-deploy.tar.gz

echo "  Cleaning up image file..."
rm /tmp/${APP_NAME}-deploy.tar.gz

echo "  Setting up Nginx configuration..."
# Use HTTP-only config if SSL certificates don't exist yet
if [ -d "${VPS_PATH}/certbot/conf/live" ] && [ "\$(ls -A ${VPS_PATH}/certbot/conf/live/ 2>/dev/null)" ]; then
    echo "  SSL certificates found - using HTTPS config"
    cp ${VPS_PATH}/nginx/default.conf ${VPS_PATH}/nginx/conf.d/default.conf
else
    echo "  No SSL certificates - using HTTP-only config"
    cp ${VPS_PATH}/nginx/default-http-only.conf ${VPS_PATH}/nginx/conf.d/default.conf
fi

echo "  Checking if .env exists..."
if [ ! -f ${VPS_PATH}/.env ]; then
    echo "  .env not found - copying from template..."
    cp ${VPS_PATH}/.env.docker.production ${VPS_PATH}/.env
    echo ""
    echo "  *** IMPORTANT: Edit .env with your configuration! ***"
    echo "  nano ${VPS_PATH}/.env"
    echo ""
fi

echo "  Stopping existing containers..."
cd ${VPS_PATH}
docker compose down 2>/dev/null || true

echo "  Starting containers..."
docker compose up -d

echo ""
echo "  Waiting for containers to start..."
sleep 15

echo ""
echo "  Container status:"
docker compose ps

echo ""
echo "  Logs (last 20 lines):"
docker compose logs --tail=20

# Set up backup cron job if not already configured
if ! crontab -l 2>/dev/null | grep -q "ers-backup"; then
    echo ""
    echo "  Setting up daily backup cron job..."
    cp ${VPS_PATH}/backup-hostinger.sh /usr/local/bin/ers-backup.sh
    chmod +x /usr/local/bin/ers-backup.sh
    (crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/ers-backup.sh >> /var/log/ers-backup.log 2>&1") | crontab -
    echo "  Daily backup cron job installed (runs at 2 AM)"
fi
DEPLOY_EOF

# Optional: Set up SSL
if [ "${SETUP_SSL}" = true ] && [ -n "${DOMAIN}" ] && [ -n "${SSL_EMAIL}" ]; then
    echo ""
    echo "Setting up SSL for ${DOMAIN}..."
    ssh ${VPS_USER}@${VPS_HOST} << SSL_EOF
set -e
cd ${VPS_PATH}

echo "  Obtaining SSL certificate for ${DOMAIN}..."
docker compose run --rm certbot certonly \
    --webroot \
    -w /var/www/certbot \
    -d ${DOMAIN} \
    --email ${SSL_EMAIL} \
    --agree-tos \
    --no-eff-email

echo "  Switching to HTTPS Nginx config..."
# Replace domain placeholder in SSL config
sed "s/\\\${DOMAIN:-localhost}/${DOMAIN}/g" ${VPS_PATH}/nginx/default.conf > ${VPS_PATH}/nginx/conf.d/default.conf

echo "  Reloading Nginx..."
docker compose exec nginx nginx -s reload

echo "  SSL setup complete for ${DOMAIN}!"
SSL_EOF
fi

# Cleanup
echo ""
echo "Cleaning up temporary files..."
rm -f ${TEMP_IMAGE}

echo ""
echo "========================================"
echo "  Deployment successful!"
echo "========================================"
echo ""
echo "Next steps:"
if [ "${SETUP_SSL}" = true ] && [ -n "${DOMAIN}" ]; then
    echo "  1. Access application: https://${DOMAIN}"
else
    echo "  1. Access application: http://${VPS_HOST}"
    echo "  2. Set up SSL (recommended):"
    echo "     $0 ${VPS_USER}@${VPS_HOST} --setup-ssl your-domain.com admin@email.com"
fi
echo ""
echo "  Default credentials: admin@admin.com / admin"
echo "  View logs: ssh ${VPS_USER}@${VPS_HOST} 'cd ${VPS_PATH} && docker compose logs -f'"
echo ""
