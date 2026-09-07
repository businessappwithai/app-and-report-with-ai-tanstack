#!/bin/bash

###############################################################################
# APPWITHAI — Local LLM Startup Script
#
# Starts the mlx_lm.server with the configured model, waits until the
# OpenAI-compatible endpoint is ready, then prints connection details.
#
# Model:   mlx-community/Qwen3-27B-4bit  (set LOCAL_AI_MODEL to override)
# Port:    8000                           (set LOCAL_AI_PORT to override)
#
# Usage:
#   ./scripts/start-llm.sh              # start in background
#   ./scripts/start-llm.sh --foreground # run in foreground (blocks)
#   ./scripts/start-llm.sh --stop       # stop a running server
#   ./scripts/start-llm.sh --status     # check server status
###############################################################################

set -e

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

# ── Configuration ──────────────────────────────────────────────────────────

# Load .env from project root if present (two levels up from scripts/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
[ -f "$PROJECT_ROOT/.env" ] && set -a && source "$PROJECT_ROOT/.env" && set +a

LLM_MODEL="${LOCAL_AI_MODEL:-mlx-community/Qwen3-27B-4bit}"
LLM_PORT="${LOCAL_AI_PORT:-8000}"
LLM_HOST="${LOCAL_AI_HOST:-127.0.0.1}"
LLM_BASE_URL="http://${LLM_HOST}:${LLM_PORT}/v1"
PID_FILE="$PROJECT_ROOT/.appwithai-llm.pid"
LOG_FILE="$PROJECT_ROOT/appwithai-llm.log"
WAIT_TIMEOUT=120  # seconds to wait for model to load

# ── Helpers ────────────────────────────────────────────────────────────────

is_server_ready() {
    curl -sf "$LLM_BASE_URL/models" > /dev/null 2>&1
}

is_running() {
    [ -f "$PID_FILE" ] && ps -p "$(cat "$PID_FILE")" > /dev/null 2>&1
}

find_mlx_server() {
    # Prefer the mlx_lm module runner; fall back to a plain binary if it's on PATH
    if command -v python3 > /dev/null 2>&1 && python3 -c "import mlx_lm" 2>/dev/null; then
        echo "python3 -m mlx_lm.server"
    elif command -v mlx_lm > /dev/null 2>&1; then
        echo "mlx_lm server"
    elif command -v mlx_lm.server > /dev/null 2>&1; then
        echo "mlx_lm.server"
    else
        echo ""
    fi
}

# ── Commands ───────────────────────────────────────────────────────────────

cmd_status() {
    print_header "LLM Server Status"
    if is_server_ready; then
        local pid=""
        is_running && pid=" (PID: $(cat "$PID_FILE"))"
        print_success "Server is running at $LLM_BASE_URL$pid"
        print_info "Model: $LLM_MODEL"
    elif is_running; then
        print_warning "Process is alive but server not yet responding"
        print_info "PID: $(cat "$PID_FILE") — check $LOG_FILE"
    else
        print_info "Server is not running"
    fi
}

cmd_stop() {
    print_header "Stopping LLM Server"
    if is_running; then
        local pid
        pid=$(cat "$PID_FILE")
        print_info "Stopping PID $pid..."
        kill "$pid" 2>/dev/null || true
        local count=0
        while ps -p "$pid" > /dev/null 2>&1 && [ $count -lt 10 ]; do
            sleep 1; count=$((count + 1)); echo -n "."
        done
        echo ""
        ps -p "$pid" > /dev/null 2>&1 && kill -9 "$pid" 2>/dev/null || true
        rm -f "$PID_FILE"
        print_success "LLM server stopped"
    else
        # Also try to kill by port in case PID file is missing
        local pids
        pids=$(lsof -ti:"$LLM_PORT" 2>/dev/null || true)
        if [ -n "$pids" ]; then
            echo "$pids" | xargs kill 2>/dev/null || true
            print_success "Killed process on :$LLM_PORT"
        else
            print_info "No server running"
        fi
    fi
}

cmd_start() {
    local foreground="${1:-false}"

    print_header "APPWITHAI — Local LLM Server"

    # Already running?
    if is_server_ready; then
        print_success "LLM server already running at $LLM_BASE_URL"
        print_info "Model: $LLM_MODEL"
        return 0
    fi

    # Find the mlx_lm launcher
    MLX_CMD=$(find_mlx_server)
    if [ -z "$MLX_CMD" ]; then
        print_error "mlx_lm is not installed or not on PATH"
        echo ""
        echo "  Install it with:"
        echo "    pip install mlx-lm"
        echo ""
        echo "  Then download the model (first run):"
        echo "    python3 -m mlx_lm.generate --model $LLM_MODEL --prompt 'hello'"
        exit 1
    fi

    print_info "Model : $LLM_MODEL"
    print_info "Port  : $LLM_PORT"
    print_info "Host  : $LLM_HOST"
    print_info "URL   : $LLM_BASE_URL"
    echo ""

    SERVER_CMD="$MLX_CMD --model $LLM_MODEL --host $LLM_HOST --port $LLM_PORT"

    if [ "$foreground" = "true" ]; then
        print_info "Running in foreground (Ctrl+C to stop)"
        exec $SERVER_CMD
    fi

    # Background mode
    print_info "Starting in background..."
    # Stop any stale instance first
    cmd_stop > /dev/null 2>&1 || true

    nohup $SERVER_CMD > "$LOG_FILE" 2>&1 &
    LLM_PID=$!
    echo "$LLM_PID" > "$PID_FILE"
    print_info "PID: $LLM_PID  |  Log: $LOG_FILE"

    # Wait for the server to load the model and respond
    echo ""
    print_info "Waiting for model to load (up to ${WAIT_TIMEOUT}s) ..."
    for i in $(seq 1 "$WAIT_TIMEOUT"); do
        if is_server_ready; then
            echo ""
            print_success "LLM server ready after ${i}s"
            break
        fi
        if ! ps -p "$LLM_PID" > /dev/null 2>&1; then
            echo ""
            print_error "mlx_lm process exited unexpectedly"
            print_info "Last log lines:"
            tail -20 "$LOG_FILE"
            exit 1
        fi
        # Progress dots every 5 s
        [ $((i % 5)) -eq 0 ] && echo -n "." || true
        sleep 1
    done

    if ! is_server_ready; then
        echo ""
        print_error "Server did not become ready within ${WAIT_TIMEOUT}s"
        print_info "Check log: tail -f $LOG_FILE"
        exit 1
    fi

    echo ""
    print_success "LLM server is ready"
    print_info "Endpoint : $LLM_BASE_URL"
    print_info "Model    : $LLM_MODEL"
    echo ""
    print_info "Test it:"
    echo "  curl $LLM_BASE_URL/models | python3 -m json.tool"
    echo ""
    print_info "Start the app:"
    echo "  ./start.sh"
    echo ""
    print_info "Stop the server:"
    echo "  ./scripts/start-llm.sh --stop"
    echo ""
}

# ── Entry point ────────────────────────────────────────────────────────────

case "${1:-}" in
    --stop)       cmd_stop ;;
    --status)     cmd_status ;;
    --foreground) cmd_start true ;;
    "")           cmd_start false ;;
    *)
        echo "Usage: $0 [--foreground | --stop | --status]"
        echo ""
        echo "  (no flag)     Start server in background"
        echo "  --foreground  Start server in foreground (blocks)"
        echo "  --stop        Stop a running server"
        echo "  --status      Show server status"
        exit 1
        ;;
esac
