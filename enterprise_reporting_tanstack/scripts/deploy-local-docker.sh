#!/bin/bash
# ==========================================
# Enterprise Reporting System
# Deploy to Local Docker Desktop
# ==========================================
# This script builds and deploys the application
# to your local Docker Desktop for testing/development.
#
# Usage:
#   chmod +x deploy-local-docker.sh
#   ./deploy-local-docker.sh [--build] [--clean]
#
# Options:
#   --build    Force rebuild of Docker image
#   --clean    Remove all data and start fresh
# ==========================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="enterprise-reporting-system"
IMAGE_NAME="${APP_NAME}:latest"
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOCAL_DATA_PATH="${SCRIPT_DIR}/.docker-data"
FORCE_BUILD=false
CLEAN_START=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --build|-b)
      FORCE_BUILD=true
      shift
      ;;
    --clean|-c)
      CLEAN_START=true
      shift
      ;;
    --help|-h)
      echo "Usage: $0 [--build] [--clean]"
      echo ""
      echo "Options:"
      echo "  --build, -b    Force rebuild of Docker image"
      echo "  --clean, -c    Remove all data and start fresh"
      echo "  --help, -h     Show this help message"
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      exit 1
      ;;
  esac
done

echo -e "${GREEN}========================================"
echo "  Deploying ${APP_NAME}"
echo "  to Local Docker Desktop"
echo -e "========================================${NC}"
echo ""
echo -e "${BLUE}  Data Path: ${LOCAL_DATA_PATH}${NC}"
echo ""

# Check Docker is running
echo -e "${YELLOW}[1/6] Checking Docker...${NC}"
if ! docker info &> /dev/null; then
    echo -e "${RED}FAILED: Docker is not running${NC}"
    echo "  Please start Docker Desktop and try again."
    exit 1
fi
echo -e "${GREEN}Docker is running${NC}"

# Clean start if requested
if [ "${CLEAN_START}" = true ]; then
    echo ""
    echo -e "${YELLOW}[2/6] Cleaning up existing data...${NC}"
    cd "${SCRIPT_DIR}"
    docker compose -f docker-compose.local.yml down -v 2>/dev/null || true
    rm -rf "${LOCAL_DATA_PATH}"
    echo -e "${GREEN}Clean complete${NC}"
else
    echo ""
    echo -e "${YELLOW}[2/6] Skipping clean (--clean not specified)${NC}"
fi

# Create local docker-compose.yml if it doesn't exist
echo ""
echo -e "${YELLOW}[3/6] Setting up Docker Compose configuration...${NC}"
if [ ! -f "${SCRIPT_DIR}/docker-compose.local.yml" ]; then
    cat > "${SCRIPT_DIR}/docker-compose.local.yml" << 'EOF'
# Enterprise Reporting System - Docker Compose for Local Development
# Simplified setup without Nginx/Certbot for local testing

services:
  redis:
    image: redis:7-alpine
    container_name: ers-local-redis
    restart: unless-stopped
    command: redis-server --appendonly yes
    ports:
      - "6380:6379"
    volumes:
      - ${DATA_PATH:-./.docker-data}/redis/data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5
    networks:
      - ers-local-network

  app:
    image: enterprise-reporting-system:latest
    container_name: ers-local-app
    restart: unless-stopped
    ports:
      - "4050:3000"
    environment:
      NODE_ENV: production
      NEXT_PUBLIC_APP_URL: http://localhost:4050
      PORT: 3000
      AUTH_SECRET: ${AUTH_SECRET:-local-dev-secret-change-in-production}
      AUTH_URL: http://localhost:4050
      DATABASE_PATH: /app/data/config.sqlite
      REDIS_URL: redis://redis:6379
      ENCRYPTION_KEY: ${ENCRYPTION_KEY:-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef}
      JOB_OUTPUT_PATH: /app/job-outputs
      MAX_CONCURRENT_JOBS: 5
      NEXT_PUBLIC_ERROR_REPORTING_EMAIL: admin@localhost
      DEFAULT_PAGE_SIZE: 50
      MAX_PAGE_SIZE: 1000
      DATA_TABLE_PAGE_SIZE: 100
      EXPORT_PAGE_SIZE: 1000
      VIRTUAL_SCROLL_THRESHOLD: 500
      ENABLE_VIRTUAL_SCROLLING: true
    volumes:
      - ${DATA_PATH:-./.docker-data}/app/data:/app/data
      - ${DATA_PATH:-./.docker-data}/app/job-outputs:/app/job-outputs
      - ${DATA_PATH:-./.docker-data}/app/uploads:/app/uploads
      - ${DATA_PATH:-./.docker-data}/app/logs:/app/logs
    depends_on:
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    networks:
      - ers-local-network

networks:
  ers-local-network:
    driver: bridge
EOF
    echo -e "${GREEN}Created docker-compose.local.yml${NC}"
else
    echo -e "${GREEN}docker-compose.local.yml already exists${NC}"
fi

# Create data directories
echo ""
echo -e "${YELLOW}[4/6] Creating data directories...${NC}"
mkdir -p "${LOCAL_DATA_PATH}/redis/data"
mkdir -p "${LOCAL_DATA_PATH}/app/data"
mkdir -p "${LOCAL_DATA_PATH}/app/job-outputs"
mkdir -p "${LOCAL_DATA_PATH}/app/uploads"
mkdir -p "${LOCAL_DATA_PATH}/app/logs"
echo -e "${GREEN}Directories created${NC}"

# Build Docker image
NEEDS_BUILD=false
if [ "${FORCE_BUILD}" = true ]; then
    NEEDS_BUILD=true
elif ! docker image inspect ${IMAGE_NAME} &> /dev/null; then
    NEEDS_BUILD=true
fi

echo ""
if [ "${NEEDS_BUILD}" = true ]; then
    echo -e "${YELLOW}[5/6] Building Docker image...${NC}"
    cd "${SCRIPT_DIR}"
    docker build -t ${IMAGE_NAME} .
    echo -e "${GREEN}Build complete${NC}"
else
    echo -e "${YELLOW}[5/6] Docker image already exists (use --build to rebuild)${NC}"
fi

# Start containers
echo ""
echo -e "${YELLOW}[6/6] Starting containers...${NC}"
cd "${SCRIPT_DIR}"
docker compose -f docker-compose.local.yml up -d

echo ""
echo -e "${YELLOW}Waiting for application to start...${NC}"
sleep 10

# Check container status
echo ""
echo -e "${GREEN}Container Status:${NC}"
docker compose -f docker-compose.local.yml ps

# Show logs
echo ""
echo -e "${GREEN}Recent Logs:${NC}"
docker compose -f docker-compose.local.yml logs --tail=15

# Check if app is responding
echo ""
echo -e "${YELLOW}Checking application health...${NC}"
sleep 5
if curl -s http://localhost:4050/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}Application is healthy!${NC}"
else
    echo -e "${YELLOW}Application may still be starting...${NC}"
    echo "  Check logs: docker compose -f docker-compose.local.yml logs -f app"
fi

# Success message
echo ""
echo -e "${GREEN}========================================"
echo "  Deployment Complete!"
echo -e "========================================${NC}"
echo ""
echo -e "${BLUE}Access the application:${NC}"
echo "  URL: http://localhost:4050"
echo ""
echo -e "${BLUE}Default credentials:${NC}"
echo "  Email: admin@admin.com"
echo "  Password: admin"
echo ""
echo -e "${BLUE}Useful commands:${NC}"
echo "  View logs:   docker compose -f docker-compose.local.yml logs -f"
echo "  Stop:        docker compose -f docker-compose.local.yml down"
echo "  Restart:     docker compose -f docker-compose.local.yml restart"
echo "  Rebuild:     $0 --build"
echo "  Fresh start: $0 --clean"
echo ""
