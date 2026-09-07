#!/bin/bash
# ==========================================
# Enterprise Reporting System
# Rebuild Docker Image
# ==========================================
# This script stops containers, removes the old
# Docker image, and builds a fresh one.
#
# Usage: ./rebuildDocker.sh
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

echo -e "${GREEN}========================================"
echo "  Rebuilding ${APP_NAME}"
echo "  Docker Image"
echo -e "========================================${NC}"
echo ""

# Step 1: Stop running containers
echo -e "${YELLOW}[1/4] Stopping running containers...${NC}"
if docker compose -f ${COMPOSE_FILE} down 2>/dev/null; then
    echo -e "${GREEN}Containers stopped${NC}"
else
    echo -e "${YELLOW}No containers were running${NC}"
fi
echo ""

# Step 2: Remove old Docker image
echo -e "${YELLOW}[2/4] Removing old Docker image...${NC}"
if docker image inspect ${IMAGE_NAME} &> /dev/null; then
    docker rmi ${IMAGE_NAME} -f
    echo -e "${GREEN}Old image removed${NC}"
else
    echo -e "${YELLOW}No existing image found${NC}"
fi
echo ""

# Step 3: Prune dangling images
echo -e "${YELLOW}[3/4] Cleaning up dangling images...${NC}"
docker image prune -f
echo -e "${GREEN}Cleanup complete${NC}"
echo ""

# Step 4: Build new Docker image
echo -e "${YELLOW}[4/4] Building new Docker image...${NC}"
echo -e "${BLUE}(This may take several minutes)${NC}"
docker build -t ${IMAGE_NAME} .
echo -e "${GREEN}Build complete${NC}"
echo ""

# Summary
echo -e "${GREEN}========================================"
echo "  Rebuild Complete!"
echo -e "========================================${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "  Start containers:  ./startDocker.sh"
echo "  View logs:         docker compose -f ${COMPOSE_FILE} logs -f"
echo ""
