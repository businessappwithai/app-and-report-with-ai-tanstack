#!/bin/bash

# Setup script for NL Query infrastructure (llama.cpp + SLM-SQL model)
# Supports both local and Docker deployments

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
  echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

# ==========================================
# 1. Check Prerequisites
# ==========================================
check_prerequisites() {
  log_info "Checking prerequisites..."

  if ! command -v docker &> /dev/null; then
    log_error "Docker is not installed. Please install Docker to use this script."
    exit 1
  fi

  if ! command -v docker-compose &> /dev/null; then
    log_error "docker-compose is not installed. Please install docker-compose."
    exit 1
  fi

  log_info "Docker and docker-compose are installed ✓"
}

# ==========================================
# 2. Create Models Directory
# ==========================================
setup_models_directory() {
  log_info "Setting up models directory..."

  mkdir -p "$PROJECT_ROOT/models"

  if [ ! -f "$PROJECT_ROOT/models/slm-sql-base-0.6b.Q3_K_M.gguf" ]; then
    log_warn "SLM-SQL model not found in $PROJECT_ROOT/models/"
    log_info "To download the model, run:"
    log_info "  curl -L -o models/slm-sql-base-0.6b.Q3_K_M.gguf https://huggingface.co/mradermacher/SLM-SQL-Base-0.6B-GGUF/resolve/main/SLM-SQL-Base-0.6B.Q3_K_M.gguf"
    log_info ""
    log_info "Model details:"
    log_info "  - Size: ~500MB (3-bit quantization)"
    log_info "  - VRAM needed: ~500MB"
    log_info "  - Speed: 30+ tokens/sec on modern GPU"
    log_info ""
    read -p "Download model now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      download_model
    fi
  else
    log_info "SLM-SQL model found ✓"
  fi
}

download_model() {
  log_info "Downloading SLM-SQL-Base-0.6B model..."
  log_info "This may take a few minutes (500MB download)..."

  if curl -L -o "$PROJECT_ROOT/models/slm-sql-base-0.6b.Q3_K_M.gguf" \
    "https://huggingface.co/mradermacher/SLM-SQL-Base-0.6B-GGUF/resolve/main/SLM-SQL-Base-0.6B.Q3_K_M.gguf"; then
    log_info "Model downloaded successfully ✓"
  else
    log_error "Failed to download model"
    exit 1
  fi
}

# ==========================================
# 3. Start Docker Services
# ==========================================
start_docker_services() {
  log_info "Starting Docker services..."
  log_info "This will start:"
  log_info "  - MariaDB (port 3306)"
  log_info "  - llama.cpp server (port 8080)"
  log_info "  - Redis (port 6379)"

  cd "$PROJECT_ROOT"

  # Check if GPU is available
  if docker run --rm --gpus all nvidia/cuda:12.4.1-runtime-ubuntu22.04 nvidia-smi &> /dev/null; then
    log_info "NVIDIA GPU detected - enabling GPU acceleration..."
    DOCKER_COMPOSE_CMD="docker-compose -f docker-compose.dev.yml --profile gpu up -d"
  else
    log_warn "No NVIDIA GPU detected - running on CPU (will be slower)"
    DOCKER_COMPOSE_CMD="docker-compose -f docker-compose.dev.yml up -d"
  fi

  if eval "$DOCKER_COMPOSE_CMD"; then
    log_info "Docker services started successfully ✓"
  else
    log_error "Failed to start Docker services"
    exit 1
  fi
}

# ==========================================
# 4. Verify Services
# ==========================================
verify_services() {
  log_info "Verifying services..."

  # Wait for services to be ready
  sleep 5

  # Check MariaDB
  if docker exec ers-postgres pg_isready -q 2>/dev/null; then
    log_info "MariaDB is running ✓"
  else
    log_error "MariaDB is not responding"
  fi

  # Check llama.cpp server
  if curl -s http://localhost:8080/health &> /dev/null; then
    log_info "llama.cpp server is running ✓"
  else
    log_warn "llama.cpp server is not responding yet (still loading model)"
  fi

  # Check Redis
  if docker exec ers-redis-dev redis-cli ping &> /dev/null; then
    log_info "Redis is running ✓"
  else
    log_error "Redis is not responding"
  fi
}

# ==========================================
# 5. Display Configuration
# ==========================================
display_config() {
  log_info "Setup complete! Your NL Query infrastructure is ready."
  echo ""
  echo "==========================================  "
  echo "SERVICE ENDPOINTS"
  echo "=========================================="
  echo "MariaDB:         localhost:3306"
  echo "  User: enterprise"
  echo "  Password: enterprise_pass"
  echo "  Database: enterprise_config"
  echo ""
  echo "llama.cpp server: http://localhost:8080"
  echo "  Model: SLM-SQL-Base-0.6B"
  echo "  API: /completion (OpenAI-compatible)"
  echo ""
  echo "Redis:           localhost:6379"
  echo ""
  echo "=========================================="
  echo "QUICK START"
  echo "=========================================="
  echo "1. Start local dev server:"
  echo "   $ set -a && source .env.local && set +a && bun run dev"
  echo ""
  echo "2. Test NL Query:"
  echo "   $ curl -X POST http://localhost:8080/completion \\"
  echo "     -H 'Content-Type: application/json' \\"
  echo "     -d '{\"prompt\": \"SELECT * FROM users WHERE is_active=1\", \"n_predict\": 256}'"
  echo ""
  echo "3. View logs:"
  echo "   $ docker-compose -f docker-compose.dev.yml logs -f llama-server"
  echo ""
  echo "4. Stop services:"
  echo "   $ docker-compose -f docker-compose.dev.yml down"
  echo ""
  echo "=========================================="
  echo ""
}

# ==========================================
# Main Execution
# ==========================================
main() {
  log_info "Starting NL Query infrastructure setup..."
  echo ""

  check_prerequisites
  setup_models_directory
  start_docker_services
  verify_services
  display_config
}

main
