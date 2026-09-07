#!/bin/bash
# ==========================================
# Enterprise Reporting System
# Hostinger VPS Setup Script
# ==========================================
# This script prepares your Hostinger VPS for running
# the Enterprise Reporting System with Docker Compose
#
# Usage:
#   1. Upload this script to your Hostinger VPS
#   2. Make it executable: chmod +x setup-hostinger.sh
#   3. Run it: sudo ./setup-hostinger.sh
# ==========================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DATA_PATH="/srv/enterprise-reporting-system"
APP_USER="root"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Enterprise Reporting System Setup${NC}"
echo -e "${GREEN}Hostinger VPS Preparation Script${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Error: Please run this script as root (sudo)${NC}"
    exit 1
fi

# Update system packages
echo -e "${YELLOW}Step 1: Updating system packages...${NC}"
apt-get update -y
apt-get upgrade -y

# Install Docker if not present
echo -e "${YELLOW}Step 2: Checking Docker installation...${NC}"
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}Installing Docker...${NC}"
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    systemctl enable docker
    systemctl start docker
    echo -e "${GREEN}Docker installed successfully${NC}"
else
    echo -e "${GREEN}Docker is already installed${NC}"
fi

# Install Docker Compose if not present
echo -e "${YELLOW}Step 3: Checking Docker Compose installation...${NC}"
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${YELLOW}Installing Docker Compose...${NC}"
    curl -SL https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-linux-x86_64 -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    echo -e "${GREEN}Docker Compose installed successfully${NC}"
else
    echo -e "${GREEN}Docker Compose is already installed${NC}"
fi

# Create data directory structure
echo -e "${YELLOW}Step 4: Creating data directory structure...${NC}"
echo -e "${GREEN}Data path: ${DATA_PATH}${NC}"

mkdir -p "${DATA_PATH}/redis/data"
mkdir -p "${DATA_PATH}/app/data"
mkdir -p "${DATA_PATH}/app/job-outputs"
mkdir -p "${DATA_PATH}/app/uploads"
mkdir -p "${DATA_PATH}/app/logs"
mkdir -p "${DATA_PATH}/nginx/conf.d"
mkdir -p "${DATA_PATH}/certbot/conf"
mkdir -p "${DATA_PATH}/certbot/www"
mkdir -p "${DATA_PATH}/backups"

echo -e "${GREEN}Directory structure created${NC}"

# Set permissions
echo -e "${YELLOW}Step 5: Setting directory permissions...${NC}"

# Redis permissions
chmod -R 755 "${DATA_PATH}/redis"
chown -R 999:999 "${DATA_PATH}/redis"

# Application data permissions
chmod -R 755 "${DATA_PATH}/app"
chown -R 1001:1000 "${DATA_PATH}/app"

# Nginx and Certbot directories
chmod -R 755 "${DATA_PATH}/nginx"
chmod -R 755 "${DATA_PATH}/certbot"

# Backups directory
chmod -R 755 "${DATA_PATH}/backups"

echo -e "${GREEN}Permissions set successfully${NC}"

# Display directory structure
echo -e "${YELLOW}Step 6: Directory structure overview...${NC}"
tree "${DATA_PATH}" 2>/dev/null || ls -lh "${DATA_PATH}"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Deploy from your local machine using:"
echo "   ./scripts/deploy-to-hostinger.sh root@YOUR_VPS_IP"
echo ""
echo "2. Edit .env on the VPS with your configuration:"
echo "   nano ${DATA_PATH}/.env"
echo "   Required values:"
echo "   - NEXT_PUBLIC_APP_URL (your domain or IP)"
echo "   - AUTH_SECRET (generate: openssl rand -base64 32)"
echo "   - REDIS_PASSWORD (generate: openssl rand -base64 24)"
echo "   - ENCRYPTION_KEY (generate: openssl rand -hex 32)"
echo ""
echo "3. Set up SSL (after initial deploy):"
echo "   ./scripts/deploy-to-hostinger.sh root@YOUR_VPS_IP --setup-ssl your-domain.com admin@email.com"
echo ""
echo "4. Check logs:"
echo "   docker compose logs -f"
echo ""
echo "5. View running containers:"
echo "   docker compose ps"
echo ""
echo -e "${YELLOW}Data will be stored at: ${DATA_PATH}${NC}"
echo -e "${YELLOW}Backup location: ${DATA_PATH}/backups${NC}"
echo ""
echo -e "${GREEN}Default login credentials:${NC}"
echo "   Email: admin@admin.com"
echo "   Password: admin"
echo ""
