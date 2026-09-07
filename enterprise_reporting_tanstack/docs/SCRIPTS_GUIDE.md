# Enterprise Reporting System - Management Scripts

## Quick Reference

### Start Development Server
```bash
./start.sh              # Start on default port 4050
./start.sh 3000         # Start on custom port
```

### Stop Development Server
```bash
./stop.sh               # Stop server on default port 4050
./stop.sh 3000          # Stop server on custom port
```

### Full Rebuild
```bash
./rebuild.sh            # Clean build and reinstall dependencies
```

## Script Details

### `start.sh`
- Starts the development server (no rebuild)
- Default port: 4050
- Checks if server is already running before starting
- Usage: `./start.sh [port]`

### `stop.sh`
- Stops the development server gracefully
- Default port: 4050
- Safe to run even if server is not running
- Usage: `./stop.sh [port]`

### `rebuild.sh`
- Performs complete clean rebuild
- Removes `.next`, `node_modules`, and `package-lock.json`
- Reinstalls all dependencies
- Creates production build
- Run this when:
  - First time setting up the project
  - After major dependency changes
  - Experiencing build issues
  - Need to clear all caches

## Typical Workflows

### Daily Development
```bash
./start.sh              # Start server
# ... work ...
./stop.sh               # Stop server
```

### After Dependency Changes
```bash
./stop.sh               # Stop server first
./rebuild.sh            # Full rebuild
./start.sh              # Start fresh server
```

### Troubleshooting Build Issues
```bash
./stop.sh               # Stop server
./rebuild.sh            # Clean rebuild
./start.sh              # Start server
```

## Access

Once started, the application is available at:
- **Development**: http://localhost:4050
- **Login**: admin@admin.com / admin
