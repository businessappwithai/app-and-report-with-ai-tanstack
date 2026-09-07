# NL Query Docker Setup Guide

Complete Docker-based setup for Text-to-SQL with specialized models optimized for mobile and edge deployment.

## Overview

This setup provides:

- **MariaDB**: Configuration database (enterprise_config)
- **llama.cpp Server**: High-performance LLM inference engine
- **SLM-SQL-Base-0.6B**: Specialized ~600M parameter Text-to-SQL model
- **Redis 7**: Job queue and caching
- **GPU Support**: Optional NVIDIA CUDA acceleration

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                Application (Bun/Node.js)                │
│                   (localhost:3000)                      │
└──────────┬──────────────────────────────────────────────┘
           │
     ┌─────┴──────────────┐
     │                    │
┌────▼────────┐    ┌─────▼──────────────────────┐
│  MariaDB    │    │   llama.cpp Text-to-SQL    │
│  (3306)     │    │   Server (8080)            │
│             │    │  - SLM-SQL-0.6B model      │
│ Config DB   │    │  - ~500MB VRAM             │
│ Users       │    │  - 30+ tokens/sec          │
│ Reports     │    │  - GPU-accelerated         │
│ Dashboards  │    │  - OpenAI-compatible API   │
└─────────────┘    └────────────────────────────┘
     │
┌────▼─────────┐
│    Redis     │
│   (6379)     │
│ Job Queue    │
└──────────────┘
```

## Quick Start

### Option 1: Automated Setup (Recommended)

```bash
# Run the automated setup script
chmod +x scripts/setup-nlquery.sh
./scripts/setup-nlquery.sh
```

This will:
1. Verify Docker installation
2. Create models directory
3. Download SLM-SQL model (if needed)
4. Start all containers
5. Verify services are running
6. Display configuration

### Option 2: Manual Docker Compose

```bash
# Create models directory
mkdir -p models

# Download the model (optional - can mount later)
curl -L -o models/slm-sql-base-0.6b.Q3_K_M.gguf \
  "https://huggingface.co/mradermacher/SLM-SQL-Base-0.6B-GGUF/resolve/main/SLM-SQL-Base-0.6B.Q3_K_M.gguf"

# Start services
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f llama-server
```

### Option 3: With GPU Acceleration

```bash
# Requires nvidia-docker
docker-compose -f docker-compose.dev.yml up -d --gpus all
```

## Service Endpoints

| Service | Endpoint | Purpose |
|---------|----------|---------|
| MariaDB | `localhost:3306` | Configuration database |
| llama.cpp | `http://localhost:8080` | Text-to-SQL inference |
| Redis | `localhost:6379` | Job queue |

## Configuration

### Environment Variables

Create or update `.env.local`:

```bash
# MariaDB (Container)
MARIADB_HOST=localhost
MARIADB_PORT=3306
MARIADB_DATABASE=enterprise_config
MARIADB_USER=enterprise
MARIADB_PASSWORD=enterprise_pass

# NL Query - llama.cpp
LLAMA_REASONING_URL=http://localhost:8080
LLAMA_REASONING_MODEL=slm-sql-base-0.6b
```

## Model Information

### SLM-SQL-Base-0.6B

- **Base Architecture**: Qwen3-0.6B
- **Parameters**: ~600 million
- **Quantization**: 3-bit (Q3_K_M)
- **Download Size**: ~500 MB
- **VRAM Required**: ~500 MB (4-bit) / ~250 MB (3-bit)
- **Inference Speed**: 30+ tokens/second
- **Specialization**: Pure SQL generation (no filler text)
- **Accuracy**: Excellent on multi-table joins and complex schemas

### Why 0.6B Model?

✅ **Fits on mobile devices** (500MB RAM)
✅ **Fast inference** (30+ tokens/sec on CPU)
✅ **Accurate SQL** (trained on SQL-specific data)
✅ **No filler text** (pure SQL output, no chat)
✅ **GPU-optional** (works on CPU, accelerates with CUDA)

## Testing NL Query

### 1. Test llama.cpp Server

```bash
curl -X POST http://localhost:8080/completion \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "SELECT * FROM users WHERE is_active = 1",
    "n_predict": 256
  }'
```

### 2. Test from Application

```bash
# Start the development server
set -a && source .env.local && set +a && bun run dev

# In browser: http://localhost:4050
# Navigate to: NL Query page
# Ask: "Show me all active users"
# Expected: SQL is generated and executed
```

### 3. Direct Database Test

```bash
# Connect to MariaDB
docker exec -it ers-mariadb-dev mariadb -u enterprise -penterprise_pass enterprise_config

# List tables
SHOW TABLES;

# Check admin user
SELECT id, email, display_name FROM users;
```

## Performance Tuning

### For CPU-Only Deployment

Edit `docker-compose.dev.yml` llama-server section:

```yaml
environment:
  LLAMA_CUDA: "0"  # Disable CUDA
```

Adjust batch size:
```yaml
CMD ["...", "--batch-size", "32"]  # Smaller batches for CPU
```

### For GPU Deployment

Enable full GPU acceleration:

```bash
# Check GPU available
docker run --rm --gpus all nvidia/cuda:12.4.1-runtime-ubuntu22.04 nvidia-smi

# Start with GPU
docker-compose -f docker-compose.dev.yml up -d
```

Increase layers on GPU:
```yaml
CMD ["...", "--gpu-layers", "35"]  # Use all 35 layers on GPU
```

## Persistence

### Database Data

MariaDB data is persisted in Docker volume `mariadb_data`. To backup:

```bash
docker-compose -f docker-compose.dev.yml exec mariadb \
  mariadb-dump -u enterprise -penterprise_pass enterprise_config \
  > backup.sql
```

### Models

Models are stored in `./models/` directory. Mount the same directory in other containers:

```yaml
volumes:
  - ./models:/app/models
```

## Troubleshooting

### llama.cpp Server not starting

```bash
# Check logs
docker-compose -f docker-compose.dev.yml logs llama-server

# Verify model file exists
ls -lh models/slm-sql-base-0.6b.Q3_K_M.gguf

# Verify GPU (if using)
docker run --rm --gpus all nvidia/cuda:12.4.1-runtime-ubuntu22.04 nvidia-smi
```

### MariaDB connection refused

```bash
# Check if container is running
docker ps | grep mariadb

# Check MariaDB health
docker-compose -f docker-compose.dev.yml ps mariadb

# Restart MariaDB
docker-compose -f docker-compose.dev.yml restart mariadb
```

### High latency/slow response

If NL Query is slow:
1. **Check GPU**: Is it being used? (`docker-compose logs llama-server`)
2. **Check CPU**: Is batch size too large?
3. **Check memory**: Run `docker stats`
4. **Reduce tokens**: Lower `n_predict` parameter

## Production Deployment

For production:

1. **Use smaller models** on CPU-only servers
2. **Add persistent volumes** for database backup
3. **Configure proper secrets** (not in .env)
4. **Add rate limiting** on llama.cpp endpoint
5. **Monitor resource usage** (docker stats)
6. **Scale llama.cpp** with load balancer if needed

## Advanced: Custom Models

To use a different model:

1. Download GGUF from Hugging Face
2. Place in `models/` directory
3. Update `docker-compose.dev.yml`:

```yaml
CMD ["/app/llama-server", 
     "-m", "/app/models/YOUR_MODEL.gguf",
     "--host", "0.0.0.0",
     "--port", "8080"]
```

4. Restart container:

```bash
docker-compose -f docker-compose.dev.yml up -d --build
```

## Cleanup

```bash
# Stop all services
docker-compose -f docker-compose.dev.yml down

# Remove all data (WARNING: Deletes database!)
docker-compose -f docker-compose.dev.yml down -v

# Remove images
docker-compose -f docker-compose.dev.yml down --rmi all
```

## References

- [llama.cpp GitHub](https://github.com/ggml-org/llama.cpp)
- [SLM-SQL GitHub](https://github.com/katanaml/sqlcoder/tree/main/models/slm-sql)
- [Hugging Face Model](https://huggingface.co/mradermacher/SLM-SQL-Base-0.6B-GGUF)
- [NVIDIA CUDA Docker](https://hub.docker.com/r/nvidia/cuda)

## Support

For issues with:
- **Model inference**: Check llama.cpp logs
- **Database**: Check MariaDB logs
- **Application**: Check application logs

```bash
# View all logs
docker-compose -f docker-compose.dev.yml logs -f

# View specific service
docker-compose -f docker-compose.dev.yml logs -f llama-server
```
