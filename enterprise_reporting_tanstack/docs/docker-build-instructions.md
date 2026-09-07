# Docker Build Instructions

## Prerequisites
1. **Start Docker Desktop**
   - On macOS: Click the Docker icon in Applications
   - Or run in terminal: `! open -a Docker`
   - Wait for Docker to start (check: `docker info` returns without error)

2. **Verify Docker is running**
   ```bash
   docker info
   ```

## Build Steps (Run in order)

### Step 1: Build Docker Image
```bash
./rebuildDocker.sh
```
This will:
- Stop any running containers
- Remove old image
- Build fresh image from Dockerfile

### Step 2: Start Containers
```bash
./startDocker.sh
```
This will:
- Start Redis container (port 6380)
- Start app container (port 4050)
- Run health checks
- Display default credentials

### Step 3: Access Application
- URL: http://localhost:4050
- Email: admin@admin.com
- Password: admin

### Step 4: View Logs (if needed)
```bash
docker compose -f docker-compose.local.yml logs -f app
```

### Step 5: Stop Containers
```bash
./stopDocker.sh
```

## Expected Build Time
- First build: 5-15 minutes (depends on machine specs and internet speed)
- Subsequent builds: 2-5 minutes (layer caching)

## Troubleshooting
- **"Docker daemon not running"**: Start Docker Desktop
- **"Port already in use"**: Change ports in docker-compose.local.yml or stop other services
- **"Build fails"**: Check docker-build.log for errors
