#!/bin/bash
# ==========================================
# Enterprise Reporting System
# Stop Docker Containers
# ==========================================
# This script stops the Docker containers
# for local development.
#
# Usage: ./stopDocker.sh
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
COMPOSE_FILE="docker-compose.local.yml"

echo -e "${GREEN}========================================"
echo "  Stopping ${APP_NAME}"
echo "  Docker Containers"
echo -e "========================================${NC}"
echo ""

# Check if containers are running
echo -e "${YELLOW}[1/2] Checking for running containers...${NC}"
RUNNING=$(docker compose -f ${COMPOSE_FILE} ps -q 2>/dev/null | wc -l)
if [ "$RUNNING" -eq 0 ]; then
    echo -e "${YELLOW}No containers are currently running${NC}"
    echo ""
    echo "To start containers, run:"
    echo "  ./startDocker.sh"
    exit 0
fi
echo -e "${GREEN}Found ${RUNNING} running container(s)${NC}"
echo ""

# Stop containers
echo -e "${YELLOW}[2/2] Stopping containers...${NC}"
docker compose -f ${COMPOSE_FILE} down
echo -e "${GREEN}Containers stopped${NC}"
echo ""

# Success message
echo -e "${GREEN}========================================"
echo "  Stopped Successfully!"
echo -e "========================================${NC}"
echo ""
echo -e "${BLUE}Useful commands:${NC}"
echo "  Start:      ./startDocker.sh"
echo "  Rebuild:    ./rebuildDocker.sh"
echo "  View logs:  docker compose -f ${COMPOSE_FILE} logs"
echo ""
