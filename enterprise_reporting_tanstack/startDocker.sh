#!/bin/bash
# ==========================================
# Enterprise Reporting System
# Start Docker Containers
# ==========================================
# This script starts the Docker containers
# for local development.
#
# Usage: ./startDocker.sh
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
COMPOSE_FILE="docker-compose.local.yml"
LOCAL_DATA_PATH="./.docker-data"

echo -e "${GREEN}========================================"
echo "  Starting ${APP_NAME}"
echo "  Docker Containers"
echo -e "========================================${NC}"
echo ""

# Check Docker is running
echo -e "${YELLOW}[1/5] Checking Docker...${NC}"
if ! docker info &> /dev/null; then
    echo -e "${RED}FAILED: Docker is not running${NC}"
    echo "  Please start Docker Desktop and try again."
    exit 1
fi
echo -e "${GREEN}Docker is running${NC}"
echo ""

# Check if image exists
echo -e "${YELLOW}[2/5] Checking Docker image...${NC}"
if ! docker image inspect ${IMAGE_NAME} &> /dev/null; then
    echo -e "${RED}Docker image not found!${NC}"
    echo "  Please run: ./rebuildDocker.sh"
    exit 1
fi
echo -e "${GREEN}Docker image found${NC}"
echo ""

# Create data directories
echo -e "${YELLOW}[3/5] Creating data directories...${NC}"
mkdir -p ${LOCAL_DATA_PATH}/redis/data
mkdir -p ${LOCAL_DATA_PATH}/app/data
mkdir -p ${LOCAL_DATA_PATH}/app/job-outputs
mkdir -p ${LOCAL_DATA_PATH}/app/uploads
mkdir -p ${LOCAL_DATA_PATH}/app/logs
echo -e "${GREEN}Directories created${NC}"
echo ""

# Start containers
echo -e "${YELLOW}[4/5] Starting containers...${NC}"
docker compose -f ${COMPOSE_FILE} up -d
echo -e "${GREEN}Containers started${NC}"
echo ""

# Wait for health check
echo -e "${YELLOW}[5/5] Waiting for application to start...${NC}"
sleep 10

# Show status
echo ""
echo -e "${GREEN}Container Status:${NC}"
docker compose -f ${COMPOSE_FILE} ps
echo ""

# Show logs
echo -e "${GREEN}Recent Logs:${NC}"
docker compose -f ${COMPOSE_FILE} logs --tail=10
echo ""

# Check health
echo -e "${YELLOW}Checking application health...${NC}"
sleep 3
if curl -s http://localhost:5050/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}Application is healthy!${NC}"
else
    echo -e "${YELLOW}Application may still be starting...${NC}"
    echo "  Check logs: docker compose -f ${COMPOSE_FILE} logs -f app"
fi
echo ""

# Success message
echo -e "${GREEN}========================================"
echo "  Started Successfully!"
echo -e "========================================${NC}"
echo ""
echo -e "${BLUE}Access the application:${NC}"
echo "  URL:  http://localhost:5050"
echo ""
echo -e "${BLUE}Default credentials:${NC}"
echo "  Email:    admin@admin.com"
echo "  Password: admin"
echo ""
echo -e "${BLUE}Useful commands:${NC}"
echo "  View logs:   docker compose -f ${COMPOSE_FILE} logs -f"
echo "  Stop:        ./stopDocker.sh"
echo "  Restart:     ./stopDocker.sh && ./startDocker.sh"
echo ""
