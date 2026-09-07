#!/bin/bash

# APPWITHAI Stop Script
# Stops web server, Mastra AI, and (optionally) the local LLM server.

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_info()    { echo -e "${BLUE}ℹ ${NC}$1"; }
print_success() { echo -e "${GREEN}✓${NC} $1"; }
print_warning() { echo -e "${YELLOW}⚠${NC} $1"; }
print_error()   { echo -e "${RED}✗${NC} $1"; }
print_header()  {
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

stop_service() {
    local pid_file="$1" name="$2"
    if [ -f "$pid_file" ]; then
        local pid
        pid=$(cat "$pid_file")
        if ps -p "$pid" > /dev/null 2>&1; then
            print_info "Stopping $name (PID: $pid)..."
            kill "$pid" 2>/dev/null || true
            local count=0
            while ps -p "$pid" > /dev/null 2>&1 && [ $count -lt 10 ]; do
                sleep 1; count=$((count + 1)); echo -n "."
            done
            echo ""
            ps -p "$pid" > /dev/null 2>&1 && kill -9 "$pid" 2>/dev/null || true
            print_success "Stopped $name"
        else
            print_warning "$name was not running (stale PID file)"
        fi
        rm -f "$pid_file"
    else
        print_info "$name is not running"
    fi
}

print_header "Stopping APPWITHAI Services"

stop_service ".appwithai-web.pid"    "Web Server"
stop_service ".appwithai-mastra.pid" "Mastra AI"
stop_service ".appwithai-llm.pid"    "LLM Server"

# Fallback: kill by port in case PID files are missing
print_info "Checking for remaining processes on known ports..."

for port in 3000 4111 8000; do
    pids=$(lsof -ti:"$port" 2>/dev/null || true)
    if [ -n "$pids" ]; then
        print_warning "Killing remaining process(es) on :$port"
        echo "$pids" | xargs kill 2>/dev/null || true
    fi
done

print_header "Cleanup Complete"
print_success "All APPWITHAI services stopped"
echo ""
print_info "Log files preserved for debugging:"
echo -e "  ${BLUE}appwithai-web.log${NC}"
echo -e "  ${BLUE}appwithai-mastra.log${NC}"
echo -e "  ${BLUE}appwithai-llm.log${NC}"
echo ""
