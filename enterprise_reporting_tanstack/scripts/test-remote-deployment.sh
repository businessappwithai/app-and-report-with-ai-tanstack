#!/bin/bash
# Test remote deployment — validate all services and functionality

set +e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

HOSTINGER_IP="${1:-}"
HOSTINGER_USER="${2:-root}"
HOSTINGER_PORT="${3:-22}"

# Test counters
PASS=0
FAIL=0

test_pass() {
    echo -e "${GREEN}✓ PASS${NC}: $1"
    ((PASS++))
}

test_fail() {
    echo -e "${RED}✗ FAIL${NC}: $1"
    ((FAIL++))
}

test_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

if [ -z "$HOSTINGER_IP" ]; then
    echo "Usage: $0 <hostinger-ip> [user] [port]"
    echo "Example: $0 192.168.1.100 root 22"
    exit 1
fi

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       Remote Deployment Test Suite                         ║${NC}"
echo -e "${BLUE}║       Target: $HOSTINGER_USER@$HOSTINGER_IP:$HOSTINGER_PORT                            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Test 1: SSH Connectivity
echo "─── Test 1: SSH Connectivity ───"
if ssh -p "$HOSTINGER_PORT" "$HOSTINGER_USER@$HOSTINGER_IP" "echo 'SSH OK'" > /dev/null 2>&1; then
    test_pass "SSH connection to $HOSTINGER_IP"
else
    test_fail "SSH connection to $HOSTINGER_IP"
    exit 1
fi

# Test 2: Container Status
echo ""
echo "─── Test 2: Docker Container Status ───"
CONTAINERS=$(ssh -p "$HOSTINGER_PORT" "$HOSTINGER_USER@$HOSTINGER_IP" << 'EOF'
docker ps --filter "name=ers-remote" --format "{{.Names}}\t{{.Status}}" | grep -E "healthy|running"
EOF
)

if [ -z "$CONTAINERS" ]; then
    test_fail "No running ers-remote containers found"
else
    while IFS=$'\t' read -r name status; do
        if [[ $status == *"healthy"* ]]; then
            test_pass "Container $name is healthy"
        elif [[ $status == *"running"* ]]; then
            test_info "Container $name is running (not yet healthy)"
        else
            test_fail "Container $name status: $status"
        fi
    done <<< "$CONTAINERS"
fi

# Test 3: MariaDB Connectivity
echo ""
echo "─── Test 3: MariaDB Database ───"
TABLE_COUNT=$(ssh -p "$HOSTINGER_PORT" "$HOSTINGER_USER@$HOSTINGER_IP" << 'EOF'
docker exec ers-postgres psql -U enterprise -d enterprise_config -e \
  "SELECT COUNT(*) FROM information_schema.TABLES WHERE table_schema='enterprise_config';" 2>/dev/null | tail -1
EOF
)

if [ ! -z "$TABLE_COUNT" ] && [ "$TABLE_COUNT" -gt 0 ]; then
    test_pass "Database connected with $TABLE_COUNT tables"
else
    test_fail "Database connectivity or empty database"
fi

# Test 4: Redis Connectivity
echo ""
echo "─── Test 4: Redis Cache ───"
REDIS_PING=$(ssh -p "$HOSTINGER_PORT" "$HOSTINGER_USER@$HOSTINGER_IP" << 'EOF'
docker exec ers-remote-redis redis-cli -a redis_pass ping 2>/dev/null || echo "FAILED"
EOF
)

if [ "$REDIS_PING" = "PONG" ]; then
    test_pass "Redis is responding to PING"
else
    test_fail "Redis not responding: $REDIS_PING"
fi

# Test 5: STT Service
echo ""
echo "─── Test 5: STT (Speech-to-Text) Service ───"
STT_HEALTH=$(ssh -p "$HOSTINGER_PORT" "$HOSTINGER_USER@$HOSTINGER_IP" << 'EOF'
curl -s http://localhost:8081/health | grep -q "status" && echo "OK" || echo "FAILED"
EOF
)

if [ "$STT_HEALTH" = "OK" ]; then
    test_pass "STT service is healthy"
else
    test_fail "STT service not responding"
fi

# Test 6: Mastra Agent Server
echo ""
echo "─── Test 6: Mastra Agent Server ───"
MASTRA_HEALTH=$(ssh -p "$HOSTINGER_PORT" "$HOSTINGER_USER@$HOSTINGER_IP" << 'EOF'
curl -s http://localhost:4111/health | grep -q "ok\|status" && echo "OK" || echo "FAILED"
EOF
)

if [ "$MASTRA_HEALTH" = "OK" ]; then
    test_pass "Mastra server is responding"
else
    test_fail "Mastra server not responding"
fi

# Test 7: Application API Health
echo ""
echo "─── Test 7: Application API ───"
APP_HEALTH=$(curl -s http://"$HOSTINGER_IP":3000/api/health 2>/dev/null || echo "")

if [[ $APP_HEALTH == *"ok"* ]] || [[ $APP_HEALTH == *"status"* ]]; then
    test_pass "Application API is responding"
    test_info "Response: $APP_HEALTH"
else
    test_fail "Application API not responding or returned: $APP_HEALTH"
fi

# Test 8: Application Web Server
echo ""
echo "─── Test 8: Application Web Server ───"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://"$HOSTINGER_IP":3000 2>/dev/null || echo "0")

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "307" ] || [ "$HTTP_CODE" = "302" ]; then
    test_pass "Web server is responding (HTTP $HTTP_CODE)"
else
    test_fail "Web server returned HTTP $HTTP_CODE"
fi

# Test 9: Docker Compose Status
echo ""
echo "─── Test 9: Docker Compose Status ───"
COMPOSE_STATUS=$(ssh -p "$HOSTINGER_PORT" "$HOSTINGER_USER@$HOSTINGER_IP" << 'EOF'
cd /root/ers && docker compose -f docker-compose.remote.yml ps --format "{{.Name}}\t{{.Status}}"
EOF
)

test_info "Docker Compose services:"
echo "$COMPOSE_STATUS" | sed 's/^/  /'

# Test 10: Disk Space
echo ""
echo "─── Test 10: Disk Space ───"
DISK_USAGE=$(ssh -p "$HOSTINGER_PORT" "$HOSTINGER_USER@$HOSTINGER_IP" << 'EOF'
df -h /root/ers | awk 'NR==2 {print $5, "used of", $2, "(" $4, "available)"}'
EOF
)

test_info "Disk usage: $DISK_USAGE"

# Test 11: Memory Usage
echo ""
echo "─── Test 11: Memory & CPU Usage ───"
STATS=$(ssh -p "$HOSTINGER_PORT" "$HOSTINGER_USER@$HOSTINGER_IP" << 'EOF'
docker stats --no-stream --format "table {{.Container}}\t{{.MemUsage}}\t{{.CPUPerc}}" | grep "ers-remote"
EOF
)

test_info "Container resource usage:"
echo "$STATS" | sed 's/^/  /'

# Test 12: Process Health from App Container
echo ""
echo "─── Test 12: Application Process Health ───"
PROCESS_CHECK=$(ssh -p "$HOSTINGER_PORT" "$HOSTINGER_USER@$HOSTINGER_IP" << 'EOF'
docker exec ers-remote-app ps aux | grep -E "node|next|bun" | grep -v grep | wc -l
EOF
)

if [ "$PROCESS_CHECK" -gt 0 ]; then
    test_pass "Application processes running ($PROCESS_CHECK processes)"
else
    test_fail "Application processes not running"
fi

# Test 13: Database Connectivity from App
echo ""
echo "─--- Test 13: App → Database Connectivity ───"
DB_CONNECT=$(ssh -p "$HOSTINGER_PORT" "$HOSTINGER_USER@$HOSTINGER_IP" << 'EOF'
docker exec ers-remote-app mysql -h psql -U enterprise -d enterprise_config -e "SELECT 1;" 2>&1 | head -1
EOF
)

if [[ $DB_CONNECT == "1" ]]; then
    test_pass "App can connect to database"
else
    test_fail "App cannot connect to database"
fi

# Test 14: Redis Connectivity from App
echo ""
echo "─── Test 14: App → Redis Connectivity ───"
REDIS_CONNECT=$(ssh -p "$HOSTINGER_PORT" "$HOSTINGER_USER@$HOSTINGER_IP" << 'EOF'
docker exec ers-remote-app redis-cli -h redis -a redis_pass ping 2>/dev/null | head -1
EOF
)

if [[ $REDIS_CONNECT == "PONG" ]]; then
    test_pass "App can connect to Redis"
else
    test_fail "App cannot connect to Redis"
fi

# Test 15: NL-to-SQL Pipeline
echo ""
echo "─── Test 15: NL-to-SQL Pipeline (Mastra) ───"
MASTRA_READY=$(ssh -p "$HOSTINGER_PORT" "$HOSTINGER_USER@$HOSTINGER_IP" << 'EOF'
docker logs ers-remote-mastra 2>&1 | grep -i "listening\|agent\|ready" | tail -1
EOF
)

if [ ! -z "$MASTRA_READY" ]; then
    test_pass "Mastra agent initialized"
    test_info "Status: $MASTRA_READY"
else
    test_info "Mastra initialization status unknown (may still be starting)"
fi

# Summary
echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                    TEST SUMMARY                            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo -e "Passed: ${GREEN}$PASS${NC}"
echo -e "Failed: ${RED}$FAIL${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed! Deployment is healthy.${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Access the application at http://$HOSTINGER_IP:3000"
    echo "2. Configure your domain/SSL if not done yet"
    echo "3. Set up automated backups"
    echo "4. Configure monitoring and alerts"
    exit 0
else
    echo -e "${RED}✗ $FAIL test(s) failed. Review logs and troubleshoot.${NC}"
    echo ""
    echo "Troubleshooting tips:"
    echo "1. Check container logs: ssh root@$HOSTINGER_IP 'docker compose -f /root/ers/docker-compose.remote.yml logs'"
    echo "2. Verify services are healthy: ssh root@$HOSTINGER_IP 'docker ps'"
    echo "3. Check configuration: ssh root@$HOSTINGER_IP 'cat /root/ers/.env'"
    exit 1
fi
