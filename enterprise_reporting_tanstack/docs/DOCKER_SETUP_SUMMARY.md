# Docker Build & Setup - Summary of Changes

## ✅ Issues Fixed

### 1. **Dockerfile Output Path Issue**
**Problem**: Dockerfile referenced `/app/dist` but TanStack Start outputs to `/app/.output`
**Fixed**: 
- Changed `COPY --from=builder /app/dist ./dist` → `COPY --from=builder /app/.output ./.output`
- Changed CMD from `bun run dist/server/server.js` → `bun .output/server/index.mjs`

### 2. **docker-compose.local.yml Missing MariaDB**
**Problem**: Local compose file didn't include MariaDB service, only Redis and app
**Fixed**:
- Added MariaDB 11-alpine service
- Configured database credentials
- Set up health checks
- Added volume for data persistence
- Updated app service to depend on MariaDB health check
- Added proper environment variables for MariaDB connection

### 3. **Database Configuration Issues**
**Problem**: docker-compose.local.yml had DATABASE_PATH (unused) instead of MARIADB_* variables
**Fixed**:
- Removed DATABASE_PATH variable
- Added proper MARIADB_* environment variables:
  - MARIADB_HOST=mariadb
  - MARIADB_PORT=3306
  - MARIADB_DATABASE=enterprise_config
  - MARIADB_USER=enterprise
  - MARIADB_PASSWORD=enterprise_pass

## 📋 Files Modified

1. **Dockerfile**
   - Line 47: `.output` directory path corrected
   - Line 78: CMD updated to use correct server entry point

2. **docker-compose.local.yml**
   - Added MariaDB service (lines 5-25)
   - Updated app environment variables (lines 50-77)
   - Added MariaDB dependency health check (lines 83-84)
   - Added volumes section (lines 100-102)

3. **New Documentation Files**
   - `DOCKER_BUILD_GUIDE.md` - Comprehensive build and run instructions
   - `DOCKER_SETUP_SUMMARY.md` - This file

## 🚀 Ready to Build

All issues have been fixed. You can now:

### Step 1: Start Docker Desktop
```bash
! open -a Docker
# Wait for Docker to fully start
```

### Step 2: Build the Docker Image
```bash
./rebuildDocker.sh
```

This will:
- Download base images (Bun, MariaDB, Redis)
- Install dependencies
- Build the application
- Create the production image

Expected time: 5-15 minutes on first build

### Step 3: Start the Containers
```bash
./startDocker.sh
```

This will:
- Create necessary directories
- Start MariaDB (port 3307)
- Start Redis (port 6380)
- Start the app (port 4050)
- Run health checks

### Step 4: Access the Application
```
🌐 http://localhost:4050
📧 admin@admin.com
🔑 admin
```

## 🔍 Verify Setup

### Check container status:
```bash
docker compose -f docker-compose.local.yml ps
```

Expected output:
```
NAME                 STATUS              PORTS
ers-local-mariadb    Up (healthy)        3307:3306
ers-local-redis      Up (healthy)        6380:6379
ers-local-app        Up (healthy)        0.0.0.0:4050->3000/tcp
```

### View logs:
```bash
# App logs
docker compose -f docker-compose.local.yml logs -f app

# MariaDB logs
docker compose -f docker-compose.local.yml logs -f mariadb

# Redis logs
docker compose -f docker-compose.local.yml logs -f redis
```

### Test health endpoints:
```bash
curl http://localhost:4050/api/health
# Should return: {"status":"ok","timestamp":"2026-05-28T..."}

curl http://localhost:3307 --user enterprise:enterprise_pass
# MariaDB should respond (or timeout, which is OK for MariaDB)

redis-cli -p 6380 ping
# Should return: PONG
```

## 🛑 Stopping

```bash
./stopDocker.sh
```

Or manually:
```bash
docker compose -f docker-compose.local.yml down
```

## 🧹 Cleanup

Remove all containers and data:
```bash
./stopDocker.sh
rm -rf .docker-data/
```

Rebuild from scratch:
```bash
docker system prune -a  # Remove unused images
./rebuildDocker.sh
./startDocker.sh
```

## 📊 Architecture

```
┌─────────────────────────────────────────────────┐
│         Docker Network (ers-local-network)      │
├──────────────┬──────────────┬──────────────────┤
│   MariaDB    │    Redis     │   Application    │
│  Port 3307   │  Port 6380   │   Port 4050      │
│              │              │                  │
│ - Bootstrap  │ - Job Queue  │ - TanStack Start │
│ - Schema     │ - Cache      │ - Bun runtime    │
│ - Users      │ - Sessions   │ - Health check   │
│ - Config     │              │                  │
└──────────────┴──────────────┴──────────────────┘
```

## 📝 Environment Variables

### From .env.local
```
AUTH_SECRET=u+xA6iwkg5BuouPQ50O4tN+cbGpB0uDk/p0ZNt17k4A=
ENCRYPTION_KEY=d2b33b537501f585cc6a16949fc1fb6086394a348e1330ce855c1816a613a0a3
MARIADB_HOST=localhost
MARIADB_PORT=3306
MARIADB_DATABASE=enterprise_config
MARIADB_USER=enterprise
MARIADB_PASSWORD=enterprise_pass
MARIADB_ROOT_PASSWORD=root_pass
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=sqlcoder:7b
```

### Docker Compose Overrides
The `docker-compose.local.yml` uses sensible defaults for:
- NODE_ENV=production
- MARIADB_HOST=mariadb (Docker internal DNS)
- REDIS_URL=redis://redis:6379 (Docker internal DNS)

## ✨ Features Enabled

After startup, these features are immediately available:

- ✅ Authentication (JWT + HTTP cookies)
- ✅ Dashboard
- ✅ SQL Editor (execute queries against external databases)
- ✅ Reports (create and export)
- ✅ Data Sources (connect to PostgreSQL, MySQL, SQL Server, Oracle, SQLite)
- ✅ Audit Logging
- ✅ Background Jobs (Redis queue)
- ✅ Natural Language Query (requires Ollama - optional)

## 🚨 Troubleshooting

See `DOCKER_BUILD_GUIDE.md` for detailed troubleshooting steps.

### Common Issues Quick Reference

| Issue | Solution |
|-------|----------|
| Docker daemon not running | Start Docker Desktop |
| Port in use (4050, 3307, 6380) | Change ports in docker-compose.local.yml or kill processes |
| Build fails | Check output with `./rebuildDocker.sh 2>&1 \| tee build.log` |
| Container exits immediately | Check logs: `docker compose -f docker-compose.local.yml logs app` |
| MariaDB connection timeout | Wait 20-30s for MariaDB to start, check health: `docker compose -f docker-compose.local.yml ps` |
| App health check failing | Normal on first 40s startup, check logs if persists |

## 📚 Next Steps

1. **Start Docker**: `! open -a Docker`
2. **Build image**: `./rebuildDocker.sh`
3. **Start containers**: `./startDocker.sh`
4. **Access app**: http://localhost:4050
5. **Test features**: Login and explore dashboard, SQL editor, reports

---

**All issues have been identified and fixed. Ready to build!** 🎉
