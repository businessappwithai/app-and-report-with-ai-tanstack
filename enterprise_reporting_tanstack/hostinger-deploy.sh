#!/bin/bash

# Enterprise Reporting System - Hostinger Deployment Helper
# Usage: ./hostinger-deploy.sh [command] [options]

set -e

# Configuration
HOSTINGER_HOST="${HOSTINGER_HOST:-148.135.137.110}"
HOSTINGER_USER="${HOSTINGER_USER:-root}"
HOSTINGER_KEY="${HOSTINGER_KEY:-$HOME/.ssh/id_ed25519}"
DEPLOY_PATH="/root/ers"
COMPOSE_FILE="docker-compose.yml"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Functions
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

ssh_cmd() {
    ssh -i "${HOSTINGER_KEY}" "${HOSTINGER_USER}@${HOSTINGER_HOST}" "$@"
}

# Commands
cmd_status() {
    log "Checking deployment status on ${HOSTINGER_HOST}..."
    ssh_cmd "cd ${DEPLOY_PATH} && docker-compose -f ${COMPOSE_FILE} ps"
}

cmd_logs() {
    local service="${1:-app}"
    log "Showing logs for ${service}..."
    ssh_cmd "cd ${DEPLOY_PATH} && docker-compose -f ${COMPOSE_FILE} logs --tail=100 -f ${service}"
}

cmd_restart() {
    log "Restarting services on ${HOSTINGER_HOST}..."
    ssh_cmd << 'EOF'
set -e
cd /root/ers
echo "🛑 Stopping containers..."
docker-compose down
echo "🚀 Starting containers..."
docker-compose up -d --wait
echo "✅ Services restarted"
docker-compose ps
EOF
}

cmd_deploy() {
    log "🚀 Starting deployment to ${HOSTINGER_HOST}..."

    # Check SSH connectivity
    info "Verifying SSH connection..."
    if ! ssh_cmd "echo 'SSH connection OK'" > /dev/null 2>&1; then
        error "Cannot connect to Hostinger via SSH. Check your SSH key and connection."
    fi

    # Deploy
    ssh_cmd << 'EOF'
set -e
cd /root/ers

echo "📥 Pulling latest code..."
git pull origin main

echo "📦 Pulling latest Docker images..."
docker-compose pull

echo "🛑 Stopping old containers..."
docker-compose down || true

echo "🚀 Starting new containers..."
docker-compose up -d --wait

echo "✅ Waiting for services to be ready..."
sleep 5

echo "🏥 Running health checks..."
docker-compose ps

if curl -s http://localhost:3000/api/health > /dev/null; then
    echo "✅ App is responding"
else
    echo "⚠️  App not responding yet, waiting..."
    sleep 10
fi

echo "✅ Deployment complete!"
EOF
}

cmd_pull() {
    log "Pulling latest code on ${HOSTINGER_HOST}..."
    ssh_cmd "cd ${DEPLOY_PATH} && git pull origin main"
}

cmd_backup() {
    log "Backing up database on ${HOSTINGER_HOST}..."
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="enterprise_config_backup_${timestamp}.sql"

    ssh_cmd << EOF
cd ${DEPLOY_PATH}
echo "Backing up database to ${backup_file}..."
docker-compose exec -T mariadb mysqldump -u enterprise -p\${MARIADB_PASSWORD} enterprise_config > ${backup_file}
echo "✅ Backup complete: ${backup_file}"
ls -lh ${backup_file}
EOF
}

cmd_restore() {
    local backup_file="$1"
    if [ -z "$backup_file" ]; then
        error "Usage: $0 restore <backup_file>"
    fi

    log "Restoring database from ${backup_file}..."
    ssh_cmd << EOF
cd ${DEPLOY_PATH}
if [ ! -f "${backup_file}" ]; then
    echo "❌ Backup file not found: ${backup_file}"
    exit 1
fi

echo "Restoring database..."
docker-compose exec -T mariadb mysql -u enterprise -p\${MARIADB_PASSWORD} enterprise_config < ${backup_file}
echo "✅ Database restore complete"
EOF
}

cmd_clean() {
    log "Cleaning up on ${HOSTINGER_HOST}..."
    ssh_cmd << 'EOF'
set -e
cd /root/ers

echo "🧹 Removing unused Docker resources..."
docker system prune -f --volumes

echo "✅ Cleanup complete"
EOF
}

cmd_shell() {
    log "Opening SSH shell to ${HOSTINGER_HOST}..."
    ssh -i "${HOSTINGER_KEY}" "${HOSTINGER_USER}@${HOSTINGER_HOST}"
}

cmd_health() {
    log "Running health checks on ${HOSTINGER_HOST}..."
    echo ""
    echo "🌐 Application:"
    if curl -s -m 5 "http://${HOSTINGER_HOST}:3000/api/health" > /dev/null 2>&1; then
        echo "  ✅ http://${HOSTINGER_HOST}:3000 - OK"
    else
        echo "  ❌ http://${HOSTINGER_HOST}:3000 - Not responding"
    fi

    echo ""
    echo "🤖 Mastra AI Agent:"
    if curl -s -m 5 "http://${HOSTINGER_HOST}:4111/health" > /dev/null 2>&1; then
        echo "  ✅ http://${HOSTINGER_HOST}:4111 - OK"
    else
        echo "  ❌ http://${HOSTINGER_HOST}:4111 - Not responding"
    fi

    echo ""
    echo "🎙️ STT Service:"
    if curl -s -m 5 "http://${HOSTINGER_HOST}:8081/health" > /dev/null 2>&1; then
        echo "  ✅ http://${HOSTINGER_HOST}:8081 - OK"
    else
        echo "  ❌ http://${HOSTINGER_HOST}:8081 - Not responding"
    fi

    echo ""
    echo "🗄️  Container Status:"
    ssh_cmd "cd ${DEPLOY_PATH} && docker-compose ps"
}

# Help
show_help() {
    cat << EOF
Enterprise Reporting System - Hostinger Deployment Helper

Usage: $0 [command] [options]

Commands:
  status              Show container status
  logs [service]      Show service logs (default: app)
  restart             Restart all services
  deploy              Full deployment (pull, rebuild, restart)
  pull                Pull latest code from Git
  backup              Backup database to SQL file
  restore <file>      Restore database from SQL file
  clean               Clean up unused Docker resources
  health              Run health checks on all services
  shell               Open SSH shell to Hostinger
  help                Show this help message

Environment Variables:
  HOSTINGER_HOST      IP/hostname (default: 148.135.137.110)
  HOSTINGER_USER      SSH username (default: root)
  HOSTINGER_KEY       SSH private key path (default: ~/.ssh/id_ed25519)

Examples:
  # Deploy new version
  $0 deploy

  # Check service status
  $0 status

  # View application logs
  $0 logs app

  # View Mastra logs
  $0 logs mastra

  # Backup database
  $0 backup

  # Restore from backup
  $0 restore enterprise_config_backup_20240101_120000.sql

  # Run health checks
  $0 health

  # SSH into server
  $0 shell

EOF
}

# Main
main() {
    local cmd="${1:-help}"

    case "$cmd" in
        status)
            cmd_status
            ;;
        logs)
            cmd_logs "$2"
            ;;
        restart)
            cmd_restart
            ;;
        deploy)
            cmd_deploy
            ;;
        pull)
            cmd_pull
            ;;
        backup)
            cmd_backup
            ;;
        restore)
            cmd_restore "$2"
            ;;
        clean)
            cmd_clean
            ;;
        health)
            cmd_health
            ;;
        shell)
            cmd_shell
            ;;
        help|-h|--help)
            show_help
            ;;
        *)
            error "Unknown command: $cmd"
            ;;
    esac
}

main "$@"
