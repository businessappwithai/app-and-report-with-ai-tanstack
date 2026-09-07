# Docker Build & Run Guide

## ✅ Changes Made

1. **Fixed Dockerfile** - Corrected build output paths:
   - Changed from `/app/dist` to `/app/.output` (TanStack Start output structure)
   - Updated CMD from `bun run dist/server/server.js` to `bun .output/server/index.mjs`

2. **Verified Environment Setup**:
   - `.env.local` has all required credentials
   - `docker-compose.local.yml` configured for local development
   - Scripts ready for build/start/stop operations

## 📋 Prerequisites

**Docker Desktop must be running**

Start Docker on macOS:
```bash
! open -a Docker
```

Or click Docker icon in Applications and wait for it to start.

Verify Docker is ready:
```bash
docker info
```

## 🚀 Quick Start

Run these commands in order:

### 1. Build the Docker Image
```bash
./rebuildDocker.sh
```

Expected output:
- Will take 5-15 minutes (first build)
- Downloads and installs dependencies
- Compiles TypeScript + builds with Vite
- Creates production image

### 2. Start the Containers
```bash
./startDocker.sh
```

Expected output:
- Starts Redis container (port 6380)
- Starts app container (port 4050)
- Performs health checks
- Shows login credentials

### 3. Access the Application

🌐 **URL**: http://localhost:4050

📧 **Default Credentials**:
- Email: `admin@admin.com`
- Password: `admin`

## 📊 Container Status

```bash
docker compose -f docker-compose.local.yml ps
```

## 📝 View Logs

```bash
# Follow app logs in real-time
docker compose -f docker-compose.local.yml logs -f app

# Follow Redis logs
docker compose -f docker-compose.local.yml logs -f redis

# View last 50 lines
docker compose -f docker-compose.local.yml logs --tail=50
```

## 🛑 Stop Containers

```bash
./stopDocker.sh
```

Or manually:
```bash
docker compose -f docker-compose.local.yml down
```

## 🔄 Rebuild (After Code Changes)

```bash
./rebuildDocker.sh && ./startDocker.sh
```

## 🐛 Common Issues

### "Docker daemon not running"
→ Start Docker Desktop (Applications > Docker > double-click)

### "Port 4050 already in use"
→ Change port in `docker-compose.local.yml` or stop other services:
```bash
lsof -i :4050  # Find what's using the port
kill -9 <PID>  # Kill the process
```

### "Port 6380 already in use"
→ Change Redis port in `docker-compose.local.yml`:
```yaml
ports:
  - "6381:6379"  # Use 6381 instead
```

### Container exits immediately
→ Check logs:
```bash
docker compose -f docker-compose.local.yml logs app
```

### Health check failing
→ Wait longer (can take 30-60s for full startup):
```bash
# Watch real-time logs
docker compose -f docker-compose.local.yml logs -f app
```

## 📦 Services

| Service | Port | Purpose |
|---------|------|---------|
| `redis` | 6380 | Job queue (Redis) |
| `app` | 4050 | Main application |

## 🗂️ Data Persistence

Local data stored in `.docker-data/`:
- `redis/data/` - Redis persistent data
- `app/data/` - Application data
- `app/job-outputs/` - Generated exports
- `app/uploads/` - User uploads
- `app/logs/` - Application logs

Clean everything:
```bash
rm -rf .docker-data/
```

## ✨ Features to Test

After startup (http://localhost:4050):

1. **Login** with admin@admin.com / admin
2. **Dashboard** - View main dashboard
3. **SQL Editor** - Test SQL query execution
4. **Reports** - Create and view reports
5. **Data Sources** - Configure external databases (optional)

## 🚨 If Build Fails

1. Check Docker logs:
   ```bash
   ./rebuildDocker.sh 2>&1 | tee build-error.log
   ```

2. Common errors:
   - **Out of disk space**: Clean up Docker (`docker system prune -a`)
   - **Build timeout**: Increase timeout in Dockerfile (add `--timeout 300`)
   - **Dependencies fail**: Check internet connection

3. Contact support with `build-error.log`

---

**Next Step**: Start Docker Desktop, then run `./rebuildDocker.sh`
