# Docker Quick Start - Enterprise Reporting System

Get the application running in Docker in 5 minutes.

## Prerequisites

- Docker and Docker Compose installed
- 2GB free RAM minimum
- 5GB free disk space

## Option 1: Local Development (Fastest)

Best for development and testing:

```bash
# 1. Start MariaDB (if not running)
docker run -d \
  --name enterprise-mariadb \
  -e MARIADB_ROOT_PASSWORD=root_pass \
  -e MARIADB_DATABASE=enterprise_config \
  -e MARIADB_USER=enterprise \
  -e MARIADB_PASSWORD=enterprise_pass \
  -p 3306:3306 \
  mariadb:latest

# 2. Start the development server
bun run dev

# 3. Open in browser
open http://localhost:4050

# Login with:
# Email: admin@admin.com
# Password: admin
```

**Startup time**: ~10 seconds
**Port**: 4050

## Option 2: Full Docker Stack

Complete containerization for production-like setup:

```bash
# 1. Start all services
docker-compose -f docker-compose.dev.yml up -d

# 2. Wait for services to be healthy (30-60 seconds)
docker-compose -f docker-compose.dev.yml ps

# 3. Open in browser
open http://localhost:3000

# Login with:
# Email: admin@admin.com
# Password: admin
```

**Startup time**: ~60 seconds (including llama.cpp build on first run)
**Port**: 3000

## Verify Everything Works

```bash
# Check all services are running
docker-compose -f docker-compose.dev.yml ps

# Verify database connection
docker exec enterprise-mariadb mariadb -u enterprise -penterprise_pass enterprise_config -e "SELECT COUNT(*) FROM users;"

# Check app health
curl http://localhost:4050/api/health

# View logs
docker-compose -f docker-compose.dev.yml logs -f
```

## Features to Test

### 1. Login
- Navigate to http://localhost:4050 (or 3000 if using Docker)
- Login with admin@admin.com / admin

### 2. View Dashboard
- Should show an empty dashboard
- Charts, reports, and metrics visible

### 3. SQL Editor
- Navigate to SQL Editor
- Create and execute queries against available data sources

### 4. Data Sources
- Manage database connections
- Add PostgreSQL, MySQL, or other supported databases
- Use connection strings like: `postgresql://user:pass@host/db?ssl=require`

### 5. Reports & Charts
- Create reports with filters and exports
- Generate charts (bar, line, pie, scatter, etc.)
- Export to CSV, XLSX, PDF

## Common Tasks

### Check Service Status

```bash
# All services
docker ps | grep enterprise

# Specific service
docker logs ers-app-dev
docker logs ers-mariadb-dev
docker logs ers-llama-server-dev
docker logs ers-redis-dev
```

### Restart Services

```bash
# Restart all
docker-compose -f docker-compose.dev.yml restart

# Restart specific service
docker-compose -f docker-compose.dev.yml restart app
```

### Access Database

```bash
# Interactive MariaDB shell
docker exec -it enterprise-mariadb mariadb \
  -u enterprise -penterprise_pass enterprise_config

# Once in shell:
SHOW TABLES;
SELECT * FROM users;
SELECT * FROM data_sources;
```

### View Application Logs

```bash
# Real-time logs
docker-compose -f docker-compose.dev.yml logs -f app

# Last 100 lines
docker-compose -f docker-compose.dev.yml logs app --tail=100

# Specific time period
docker-compose -f docker-compose.dev.yml logs app --since=5m
```

### Stop All Services

```bash
# Stop running containers (keep data)
docker-compose -f docker-compose.dev.yml down

# Stop and remove all data (CAREFUL!)
docker-compose -f docker-compose.dev.yml down -v
```

## Environment Configuration

Default values in `.env.local`:

```
# Authentication & Encryption
AUTH_SECRET=u+xA6iwkg5BuouPQ50O4tN+cbGpB0uDk/p0ZNt17k4A=
ENCRYPTION_KEY=d2b33b537501f585cc6a16949fc1fb6086394a348e1330ce855c1816a613a0a3

# MariaDB
MARIADB_HOST=localhost
MARIADB_PORT=3306
MARIADB_DATABASE=enterprise_config
MARIADB_USER=enterprise
MARIADB_PASSWORD=enterprise_pass
MARIADB_ROOT_PASSWORD=root_pass

# Llama.cpp (NL Query)
LLAMA_REASONING_URL=http://localhost:8080
LLAMA_REASONING_MODEL=slm-sql-base-0.6b
```

## Troubleshooting

### Port Already in Use

```bash
# Find what's using port 4050 (or 3000, 3306, etc.)
lsof -i :4050

# Kill the process
kill -9 <PID>

# Or use a different port in docker-compose.dev.yml
```

### MariaDB Won't Start

```bash
# Check MariaDB logs
docker logs enterprise-mariadb

# Verify it's listening
docker exec enterprise-mariadb mariadb-admin ping

# Restart it
docker-compose -f docker-compose.dev.yml restart mariadb
```

### Application Crashes on Startup

```bash
# View detailed logs
docker logs -f ers-app-dev

# Common issue: Database not ready
# Solution: Ensure MariaDB is healthy before app starts
docker-compose -f docker-compose.dev.yml ps

# Status should show "healthy" for mariadb
```

### Llama.cpp Server Not Ready

First build takes 15-30 minutes. Check progress:

```bash
docker logs ers-llama-server-dev --tail=50 -f
```

Once complete, the endpoint will be available at `http://localhost:8080/health`

## Performance

| Component | RAM | Startup | Notes |
|-----------|-----|---------|-------|
| App | 200MB | 5s | Local dev: 2s |
| MariaDB | 256MB | 10s | First init slower |
| Llama.cpp | 2GB | 20-30min | First build only |
| Redis | 50MB | 2s | Lightweight |
| **Total** | **2.5GB** | **~60s** | Full stack |

## Next Steps

1. **Add Data Sources**
   - Navigate to Data Sources
   - Connect to your databases
   - Test query execution

2. **Create Reports**
   - Build reports from saved queries
   - Add filters and visualizations
   - Set up exports

3. **Setup NL Query (Optional)**
   - Ensure llama.cpp server is running
   - Navigate to NL Query page
   - Ask natural language questions

4. **Configure Authentication**
   - Manage users and roles
   - Set granular permissions
   - Audit access logs

## Getting Help

- **Documentation**: See `/DOCKER_DEPLOYMENT.md` for comprehensive guide
- **Logs**: Check Docker logs for detailed error messages
- **GitHub Issues**: Report problems or request features

## Quick Commands Reference

```bash
# Start everything
docker-compose -f docker-compose.dev.yml up -d

# View status
docker-compose -f docker-compose.dev.yml ps

# View logs
docker-compose -f docker-compose.dev.yml logs -f

# Stop everything
docker-compose -f docker-compose.dev.yml down

# Clean everything (including data!)
docker-compose -f docker-compose.dev.yml down -v

# Restart a service
docker-compose -f docker-compose.dev.yml restart app

# View database
docker exec -it enterprise-mariadb mariadb -u enterprise -penterprise_pass enterprise_config

# Test health
curl http://localhost:4050/api/health
```

---

**Ready to go?** Start with Option 1 (Local Development) for fastest setup, or Option 2 (Full Docker) for a complete containerized environment.

For detailed configuration and advanced topics, see `/DOCKER_DEPLOYMENT.md`.
