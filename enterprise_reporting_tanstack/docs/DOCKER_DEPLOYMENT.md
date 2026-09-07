# Docker Deployment Guide - Enterprise Reporting System

Complete Docker-based deployment for the Enterprise Reporting System with TanStack Start, Bun, MariaDB, and Llama.cpp for NL Query support.

## Quick Start

### 1. Local Development (Recommended for Development)

The application works perfectly with local components + Docker services:

```bash
# Ensure MariaDB is running
docker ps | grep mariadb || docker run -d \
  --name enterprise-mariadb \
  -e MARIADB_ROOT_PASSWORD=root_pass \
  -e MARIADB_DATABASE=enterprise_config \
  -e MARIADB_USER=enterprise \
  -e MARIADB_PASSWORD=enterprise_pass \
  -p 3306:3306 \
  mariadb:latest

# Start development server (Bun/TanStack Start)
bun run dev

# In another terminal, start the llama.cpp server for NL Query (optional)
./scripts/setup-nlquery.sh

# Access the app at http://localhost:4050
```

### 2. Full Docker Stack

For a fully containerized deployment:

```bash
# Set environment variables
export AUTH_SECRET="your-secret-key-min-32-chars"
export ENCRYPTION_KEY="your-encryption-key-hex-64-chars"

# Build and start all services
docker-compose -f docker-compose.dev.yml up -d

# Access the app at http://localhost:3000
```

## Architecture

```
┌─────────────────────────────────────┐
│  Enterprise Reporting System         │
│  (TanStack Start + Bun)              │
│  Port: 3000 (Docker) / 4050 (Dev)   │
└──────────────┬──────────────────────┘
               │
        ┌──────┼──────┐
        │      │      │
┌───────▼──┐ ┌─▼──────────┐  ┌──────────────┐
│ MariaDB  │ │ llama.cpp  │  │ Redis        │
│ Port 3306│ │ Port 8080  │  │ Port 6379    │
│ Config DB│ │ NL Query   │  │ Job Queue    │
└──────────┘ └────────────┘  └──────────────┘
```

## Services

### MariaDB (Configuration Database)

- **Image**: mariadb:latest
- **Port**: 3306
- **Database**: enterprise_config
- **User**: enterprise
- **Password**: enterprise_pass (from .env)
- **Persistence**: Docker volume `mariadb_data`
- **Tables**: 29 (users, roles, data_sources, reports, dashboards, jobs, audit_logs, etc.)

**Features**:
- Full SQL compatibility and ACID transactions
- Instant persistence (data written immediately)
- Enterprise-grade reliability
- Encryption of sensitive fields (connection credentials)

### Llama.cpp Server (NL Query)

- **Image**: Custom build from Dockerfile.nlquery
- **Port**: 8080
- **Model**: SLM-SQL-Base-0.6B (Text-to-SQL)
- **Features**:
  - 600M parameters (optimized for edge/mobile)
  - 3-bit quantization (Q3_K_M)
  - ~500MB download size
  - 30+ tokens/second inference
  - OpenAI-compatible API

**Health Check**: `http://localhost:8080/health`

### Redis (Job Queue)

- **Image**: redis:7-alpine  
- **Port**: 6379
- **Purpose**: Caching and background job coordination
- **Persistence**: Docker volume `redis_data`

## Building the Application

### Local Development Build

```bash
# Install dependencies
bun install

# Build application (outputs to dist/)
bun run build

# Run development server
bun run dev
```

### Docker Build

```bash
# Build main application image
docker-compose -f docker-compose.dev.yml build app

# Build llama.cpp server image
docker-compose -f docker-compose.dev.yml build llama-server

# Build all services
docker-compose -f docker-compose.dev.yml build
```

## Configuration

### Environment Variables (.env.local)

```bash
# Authentication
AUTH_SECRET=your-32-char-secret-key
ENCRYPTION_KEY=your-64-char-hex-key

# MariaDB
MARIADB_HOST=localhost          # 'mariadb' in Docker
MARIADB_PORT=3306
MARIADB_DATABASE=enterprise_config
MARIADB_USER=enterprise
MARIADB_PASSWORD=enterprise_pass
MARIADB_ROOT_PASSWORD=root_pass

# Llama.cpp Server (NL Query)
LLAMA_REASONING_URL=http://localhost:8080   # 'http://llama-server:8080' in Docker
LLAMA_REASONING_MODEL=slm-sql-base-0.6b
```

### Docker Compose Override

You can create a `docker-compose.override.yml` to customize locally:

```yaml
services:
  app:
    environment:
      NODE_ENV: development
      DEBUG: "1"
    ports:
      - "3000:3000"
```

## Testing

### 1. Health Checks

```bash
# App health
curl http://localhost:4050/api/health

# MariaDB
docker exec enterprise-mariadb mariadb-admin ping

# Redis
docker exec ers-redis-dev redis-cli ping

# Llama.cpp
curl http://localhost:8080/health
```

### 2. Database Verification

```bash
# Connect to MariaDB
docker exec -it enterprise-mariadb mariadb -u enterprise -penterprise_pass enterprise_config

# Check tables
SHOW TABLES;

# Verify admin user
SELECT id, email, display_name FROM users;
```

### 3. Login Test

1. Navigate to http://localhost:4050 (or http://localhost:3000 in Docker)
2. You should be redirected to login
3. Default credentials:
   - Email: `admin@admin.com`
   - Password: `admin`

### 4. Test Data Sources

1. After login, go to Data Sources
2. Create a new data source:
   - Name: "Hospital Management (Demo)"
   - Type: PostgreSQL
   - Connection String: `postgresql://user:pass@neon-host/hospital_db?ssl=require`
   - Or provide individual fields: host, port, database, user, password

### 5. Test NL Query

1. Ensure llama.cpp server is running
2. Navigate to "NL Query" page (/_authed/nl-query)
3. Ask a question: "Show me total patients by gender"
4. Verify SQL generation and execution

## Troubleshooting

### Port Conflicts

If ports are already in use:
```bash
# Change ports in docker-compose.dev.yml
# Or kill existing processes
lsof -i :3306    # MariaDB
lsof -i :8080    # Llama.cpp
lsof -i :6379    # Redis
```

### MariaDB Connection Failed

```bash
# Verify container is running
docker ps | grep mariadb

# Check health
docker ps --filter "name=enterprise-mariadb" --format "table {{.Names}}\t{{.Status}}"

# View logs
docker logs enterprise-mariadb
```

### Llama.cpp Takes Too Long

The llama.cpp build compiles from source:
- First build: 15-30 minutes (depending on CPU)
- Subsequent builds: Use cached layers

**Optimize**:
```bash
# Use pre-built binary (if available)
# Or build only when needed
docker-compose -f docker-compose.dev.yml build --no-cache llama-server
```

### Application Won't Start

1. Check database is ready:
   ```bash
   docker exec enterprise-mariadb mariadb-admin ping
   ```

2. Check logs:
   ```bash
   docker logs ers-app-dev
   ```

3. Verify environment:
   ```bash
   docker exec ers-app-dev env | grep MARIADB
   ```

## Production Deployment

### Recommended Setup

1. **Use managed MariaDB** (AWS RDS, Azure Database, etc.)
   - Set `MARIADB_HOST` to your managed instance

2. **Use managed Redis** (AWS ElastiCache, etc.)
   - Or use Upstash Redis for serverless

3. **Deploy app container** to:
   - Docker Hub / private registry
   - Kubernetes cluster
   - Cloud Run / Fargate
   - Traditional VM with docker-compose

4. **Optional: Deploy llama.cpp separately**
   - Autoscale based on demand
   - Use GPU instances for faster inference
   - Or use cloud AI APIs as fallback

### Production Dockerfile

Create `Dockerfile.prod` for optimized production builds:

```dockerfile
FROM oven/bun:1.3-alpine
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile && bun pm cache rm
COPY . .
RUN bun run build
ENV NODE_ENV=production
EXPOSE 3000
CMD ["bun", "run", "dist/server/server.js"]
```

### Docker Registry

```bash
# Build and push to registry
docker tag enterprise-app myregistry.azurecr.io/enterprise-app:1.0
docker push myregistry.azurecr.io/enterprise-app:1.0
```

## Performance Notes

### Local Development
- **Startup**: ~5-10 seconds
- **Hot reload**: <1 second (Vite)
- **Database**: ~50ms per query (MariaDB local)

### Docker Deployment
- **Startup**: ~30 seconds (container init + health checks)
- **Response time**: <100ms (MariaDB in container)
- **Memory**: ~400MB (app) + 300MB (MariaDB) + 500MB (llama.cpp)

### Optimization Tips

1. **Use connection pooling**
   - Already configured in Kysely (10 connections)

2. **Enable Redis caching**
   - Automatic job queue caching

3. **Optimize llama.cpp**
   - Use GPU acceleration (`--gpus all`)
   - Reduce model size if needed
   - Increase batch size for throughput

## Scaling

### Horizontal Scaling

```yaml
# docker-compose.prod.yml
services:
  app:
    deploy:
      replicas: 3
  llama-server:
    deploy:
      replicas: 2
```

### Load Balancing

Use Nginx or similar:

```nginx
upstream app {
    server app1:3000;
    server app2:3000;
    server app3:3000;
}

server {
    listen 80;
    location / {
        proxy_pass http://app;
    }
}
```

## Data Persistence

### Backup MariaDB

```bash
# One-time backup
docker exec enterprise-mariadb mariadb-dump \
  -u enterprise -penterprise_pass enterprise_config \
  > backup.sql

# Restore
docker exec -i enterprise-mariadb mariadb \
  -u enterprise -penterprise_pass enterprise_config \
  < backup.sql
```

### Backup Volumes

```bash
# Backup MariaDB volume
docker run --rm \
  -v enterprise_reporting_tanstack_mariadb_data:/data \
  -v /backup:/backup \
  alpine tar czf /backup/mariadb-backup.tar.gz /data

# Restore
docker run --rm \
  -v enterprise_reporting_tanstack_mariadb_data:/data \
  -v /backup:/backup \
  alpine tar xzf /backup/mariadb-backup.tar.gz -C /
```

## Clean Up

```bash
# Stop containers
docker-compose -f docker-compose.dev.yml down

# Remove containers, networks, and volumes
docker-compose -f docker-compose.dev.yml down -v

# Remove images
docker-compose -f docker-compose.dev.yml down --rmi all
```

## Monitoring

### Logs

```bash
# View all logs
docker-compose -f docker-compose.dev.yml logs -f

# View specific service
docker-compose -f docker-compose.dev.yml logs -f app
docker-compose -f docker-compose.dev.yml logs -f llama-server
docker-compose -f docker-compose.dev.yml logs -f mariadb
```

### Resource Usage

```bash
# Monitor CPU/memory
docker stats

# Per-container stats
docker stats ers-app-dev ers-mariadb-dev ers-llama-server-dev
```

### Health Checks

Configured in `docker-compose.dev.yml`:
- **MariaDB**: `healthcheck.sh --connect --innodb_initialized`
- **App**: `curl -f http://localhost:3000/api/health`
- **Llama.cpp**: `curl -f http://localhost:8080/health`
- **Redis**: `redis-cli ping`

## Security

### Environment Secrets

Never commit secrets to git:
```bash
# Use .env.local (gitignored)
AUTH_SECRET=<actual-secret>
ENCRYPTION_KEY=<actual-key>

# Or use Docker secrets (Swarm mode)
docker secret create auth_secret -
```

### Network Isolation

Services communicate via internal Docker network (`ers-network`):
- MariaDB only accessible from app
- Redis only accessible from app
- Only app port 3000 exposed externally

### SSL/TLS

For production, use Nginx with Let's Encrypt:
```bash
# See nginx/ directory for configuration
```

## Support & Resources

- **TanStack Start**: https://tanstack.com/router/latest
- **Bun**: https://bun.sh/docs
- **Kysely**: https://kysely.dev/
- **MariaDB**: https://mariadb.com/docs/
- **Llama.cpp**: https://github.com/ggml-org/llama.cpp
- **Docker**: https://docs.docker.com/

## Changelog

### v1.0 - May 27, 2026
- Initial Docker setup with Bun + TanStack Start
- MariaDB configuration database integration
- Llama.cpp server for NL Query support
- Complete documentation and deployment guides
- Local development and Docker deployment options
