#!/bin/bash

# APPWITHAI Start Script
# Starts the web app (TanStack Start / Vite) and Mastra AI service.
# For the local LLM server use: ./scripts/start-llm.sh
# Optional services that fail to start are skipped with an error message.
# Only the web service (frontend + backend) is mandatory.

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

WEB_PID_FILE=".appwithai-web.pid"
MASTRA_PID_FILE=".appwithai-mastra.pid"
MAX_RETRIES=3

is_running() {
    local pid_file="$1"
    if [ -f "$pid_file" ]; then
        local pid
        pid=$(cat "$pid_file")
        if ps -p "$pid" > /dev/null 2>&1; then return 0; fi
        rm -f "$pid_file"
    fi
    return 1
}

kill_existing() {
    local pid_file="$1" name="$2"
    if is_running "$pid_file"; then
        local pid
        pid=$(cat "$pid_file")
        print_warning "Stopping existing $name (PID: $pid)..."
        kill "$pid" 2>/dev/null || true
        sleep 2
        ps -p "$pid" > /dev/null 2>&1 && kill -9 "$pid" 2>/dev/null || true
        rm -f "$pid_file"
        print_success "Stopped $name"
    fi
}

# Returns 0 if a script is defined in root package.json, 1 otherwise
script_exists() {
    bun -e "const fs=require('fs');try{const p=JSON.parse(fs.readFileSync('./package.json','utf8'));process.exit(p.scripts&&p.scripts['$1']!==undefined?0:1);}catch(e){process.exit(1);}" 2>/dev/null
}

# start_with_retry <name> <pid_file> <log_file> <bun_script> [health_url] [wait_seconds]
# Tries up to MAX_RETRIES times. Sets STARTED_PID on success, returns 0/1.
start_with_retry() {
    local name="$1" pid_file="$2" log_file="$3" bun_script="$4"
    local health_url="${5:-}" wait_secs="${6:-3}"
    STARTED_PID=""

    for attempt in $(seq 1 "$MAX_RETRIES"); do
        [ "$attempt" -gt 1 ] && print_info "Retrying $name (attempt $attempt/$MAX_RETRIES)..."

        kill_existing "$pid_file" "$name"

        nohup bun run "$bun_script" > "$log_file" 2>&1 &
        local pid=$!
        echo "$pid" > "$pid_file"

        sleep "$wait_secs"

        if ! is_running "$pid_file"; then
            print_warning "Attempt $attempt: $name process exited early"
            [ "$attempt" -lt "$MAX_RETRIES" ] && sleep 2
            continue
        fi

        if [ -n "$health_url" ]; then
            local ready=false
            for i in $(seq 1 20); do
                if curl -sf "$health_url" > /dev/null 2>&1; then
                    ready=true
                    break
                fi
                sleep 1
            done
            if ! $ready; then
                print_warning "Attempt $attempt: $name not responding at $health_url"
                kill "$pid" 2>/dev/null || true
                rm -f "$pid_file"
                [ "$attempt" -lt "$MAX_RETRIES" ] && sleep 2
                continue
            fi
        fi

        STARTED_PID="$pid"
        return 0
    done

    print_error "$name failed to start after $MAX_RETRIES attempts — check $log_file"
    return 1
}

print_header "Starting APPWITHAI"

# Prerequisite checks
if ! command -v bun &> /dev/null; then
    print_error "Bun.js is not installed — install from https://bun.sh"
    exit 1
fi
print_info "Bun.js $(bun --version)"

if [ ! -d "node_modules" ]; then
    print_warning "node_modules missing — running bun install..."
    bun install
fi

# Warn if LLM server is not reachable
LLM_URL="${LOCAL_AI_BASE_URL:-http://localhost:8000/v1}"
if ! curl -sf "$LLM_URL/models" > /dev/null 2>&1; then
    print_warning "Local LLM server not detected at $LLM_URL"
    print_info    "Start it first: ./scripts/start-llm.sh"
fi

# Stop stale processes
kill_existing "$WEB_PID_FILE"    "Web Server"
kill_existing "$MASTRA_PID_FILE" "Mastra AI"

# ── Mastra AI (optional) ───────────────────────────────────────────────────
MASTRA_PID=""
MASTRA_OK=false
print_header "Starting Mastra AI Service"
if ! script_exists "dev:mastra"; then
    print_error "Script 'dev:mastra' not found in package.json — skipping Mastra AI"
else
    if start_with_retry "Mastra AI" "$MASTRA_PID_FILE" "appwithai-mastra.log" "dev:mastra" "http://localhost:4111/api/health" 10; then
        MASTRA_PID="$STARTED_PID"
        MASTRA_OK=true
        print_success "Mastra AI started (PID: $MASTRA_PID)"
        print_info    "Mastra running at: ${BLUE}http://localhost:4111${NC}"
    fi
fi

# ── Web App (required — serves both frontend and backend) ──────────────────
print_header "Starting Web Server (TanStack Start)"
if ! script_exists "dev"; then
    print_error "Script 'dev' not found in package.json — cannot start web server"
    exit 1
fi

WEB_PID=""
if start_with_retry "Web Server" "$WEB_PID_FILE" "appwithai-web.log" "dev" "http://localhost:3000" 5; then
    WEB_PID="$STARTED_PID"
    print_success "Web server started (PID: $WEB_PID)"
else
    print_info "Check: tail -50 appwithai-web.log"
    exit 1
fi

# ── Summary ────────────────────────────────────────────────────────────────
print_header "Services Running"
if $MASTRA_OK; then
    echo -e "${GREEN}✓${NC} Mastra AI  — http://localhost:4111   (PID: $MASTRA_PID)"
else
    echo -e "${YELLOW}⚠${NC} Mastra AI  — not running"
fi
echo -e "${GREEN}✓${NC} Web Server — http://localhost:3000   (PID: $WEB_PID)"
echo ""
print_info "Key URLs:"
echo -e "  ${BLUE}Dashboard${NC}: http://localhost:3000/dashboard"
echo -e "  ${BLUE}Projects${NC}:  http://localhost:3000/projects"
if $MASTRA_OK; then
    echo -e "  ${BLUE}Mastra${NC}:    http://localhost:4111"
fi
echo ""
print_info "Logs:"
echo -e "  tail -f appwithai-web.log"
if $MASTRA_OK; then
    echo -e "  tail -f appwithai-mastra.log"
fi
echo ""
print_info "To stop: ${GREEN}./stop.sh${NC}"
echo ""
