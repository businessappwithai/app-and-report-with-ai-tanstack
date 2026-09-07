#!/bin/bash
# Deploy to Hostinger — automated setup and testing

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
HOSTINGER_IP="${1:-}"
HOSTINGER_USER="${2:-root}"
HOSTINGER_PORT="${3:-22}"
LOCAL_APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REMOTE_APP_DIR="/root/ers"

# Helper functions
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
    exit 1
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Step 1: Validate inputs
if [ -z "$HOSTINGER_IP" ]; then
    error "Usage: $0 <hostinger-ip> [user] [port]"
fi

log "Deploying to Hostinger: $HOSTINGER_USER@$HOSTINGER_IP:$HOSTINGER_PORT"
log "Local source: $LOCAL_APP_DIR"
log "Remote destination: $REMOTE_APP_DIR"

# Step 2: Test SSH connection
log "Testing SSH connection..."
ssh -p "$HOSTINGER_PORT" "$HOSTINGER_USER@$HOSTINGER_IP" "echo 'SSH connection OK'" || \
    error "Cannot connect to $HOSTINGER_USER@$HOSTINGER_IP:$HOSTINGER_PORT"

# Step 3: Check prerequisites on Hostinger
log "Checking Hostinger prerequisites..."
ssh -p "$HOSTINGER_PORT" "$HOSTINGER_USER@$HOSTINGER_IP" << 'EOF'
    which docker > /dev/null || (echo "Docker not found" && exit 1)
    which docker-compose > /dev/null || (echo "Docker Compose not found" && exit 1)
    docker ps > /dev/null || (echo "Docker daemon not running" && exit 1)
    echo "Prerequisites OK: Docker and Docker Compose are installed"
EOF

# Step 4: Create remote directory
log "Creating remote directory structure..."
ssh -p "$HOSTINGER_PORT" "$HOSTINGER_USER@$HOSTINGER_IP" "mkdir -p $REMOTE_APP_DIR/backups"

# Step 5: Export local database
log "Exporting local MariaDB database..."
DUMP_FILE="/tmp/enterprise_config_$(date +%Y%m%d_%H%M%S).sql"
mysqldump -h 127.0.0.1 -P 3307 -u enterprise -penterprise_pass enterprise_config > "$DUMP_FILE" || \
    error "Failed to dump local database"
log "Database exported to $DUMP_FILE"

# Step 6: Sync files to remote
log "Syncing files to Hostinger (excluding node_modules, .next, .docker-data)..."
rsync -avz \
    --rsh="ssh -p $HOSTINGER_PORT" \
    --exclude=node_modules \
    --exclude=.next \
    --exclude=.docker-data \
    --exclude=.git \
    --exclude='.git*' \
    --exclude=dist \
    --exclude=build \
    --exclude='*.log' \
    "$LOCAL_APP_DIR/" \
    "$HOSTINGER_USER@$HOSTINGER_IP:$REMOTE_APP_DIR/" || \
    error "Sync failed"

log "Copying database dump to Hostinger..."
scp -P "$HOSTINGER_PORT" "$DUMP_FILE" \
    "$HOSTINGER_USER@$HOSTINGER_IP:$REMOTE_APP_DIR/enterprise_config_backup.sql"

# Step 7: Prepare remote environment
log "Setting up remote environment..."
ssh -p "$HOSTINGER_PORT" "$HOSTINGER_USER@$HOSTINGER_IP" << EOF
    cd $REMOTE_APP_DIR

    # Check if .env exists, otherwise create from example
    if [ ! -f .env ]; then
        if [ -f .env.remote.example ]; then
            cp .env.remote.example .env
            echo "Created .env from example"
        else
            echo "ERROR: .env.remote.example not found"
            exit 1
        fi
    fi

    echo "Remote environment prepared"
EOF

# Step 8: Deploy containers
log "Starting Docker containers on Hostinger..."
ssh -p "$HOSTINGER_PORT" "$HOSTINGER_USER@$HOSTINGER_IP" << EOF
    cd $REMOTE_APP_DIR
    docker compose -f docker-compose.remote.yml up -d --build

    # Wait for services to be healthy
    echo "Waiting for services to be healthy..."
    sleep 30
    docker compose -f docker-compose.remote.yml ps
EOF

# Step 9: Import database
log "Importing database into remote MariaDB..."
ssh -p "$HOSTINGER_PORT" "$HOSTINGER_USER@$HOSTINGER_IP" << EOF
    cd $REMOTE_APP_DIR
    docker exec ers-postgres psql -U enterprise -d enterprise_config < enterprise_config_backup.sql

    # Verify import
    TABLE_COUNT=\$(docker exec ers-postgres psql -U enterprise -d enterprise_config -e "SELECT COUNT(*) FROM information_schema.TABLES WHERE table_schema='enterprise_config';" | tail -1)
    echo "Database imported with \$TABLE_COUNT tables"
EOF

# Step 10: Run tests
log "Testing remote deployment..."
ssh -p "$HOSTINGER_PORT" "$HOSTINGER_USER@$HOSTINGER_IP" << EOF
    cd $REMOTE_APP_DIR

    echo "=== Container Status ==="
    docker compose -f docker-compose.remote.yml ps

    echo ""
    echo "=== Health Checks ==="
    echo -n "MariaDB: "
    docker exec ers-postgres pg_isready -U enterprise -d enterprise_config && echo "✓ Healthy" || echo "✗ Unhealthy"

    echo -n "Redis: "
    docker exec ers-remote-redis redis-cli ping > /dev/null && echo "✓ Healthy" || echo "✗ Unhealthy"

    echo -n "STT: "
    curl -s http://localhost:8081/health > /dev/null && echo "✓ Healthy" || echo "✗ Unhealthy"

    echo -n "Mastra: "
    curl -s http://localhost:4111/health > /dev/null && echo "✓ Healthy" || echo "✗ Unhealthy"

    echo -n "App: "
    curl -s http://localhost:3000/api/health > /dev/null && echo "✓ Healthy" || echo "✗ Unhealthy"

    echo ""
    echo "=== Database Tables ==="
    docker exec ers-postgres psql -U enterprise -d enterprise_config -e "\\dt" | head -20
EOF

# Step 11: Summary
log "✓ Deployment complete!"
echo ""
echo "=== Next Steps ==="
echo "1. SSH into Hostinger and review .env:"
echo "   ssh -p $HOSTINGER_PORT $HOSTINGER_USER@$HOSTINGER_IP"
echo "   cd $REMOTE_APP_DIR && nano .env"
echo ""
echo "2. Update configuration as needed:"
echo "   - NEXT_PUBLIC_APP_URL (your domain or IP)"
echo "   - AUTH_URL"
echo "   - AI_NL2SQL_API_KEY (if different)"
echo ""
echo "3. Restart containers after env changes:"
echo "   docker compose -f docker-compose.remote.yml restart"
echo ""
echo "4. Access the application:"
echo "   http://$HOSTINGER_IP:3000"
echo ""
echo "5. View logs:"
echo "   docker compose -f docker-compose.remote.yml logs -f"
echo ""

log "Backup database available at: $DUMP_FILE"
