# Enterprise Reporting System - Setup Guide

## Quick Start

### 1. Initialize the System

Run the setup script to initialize both databases and create the admin user:

```bash
bun run setup
```

This will:
- ✅ Initialize PGLite database at `./data`
- ✅ Create all required tables
- ✅ Create Administrator role with full permissions
- ✅ Create admin user: `admin@admin.com` / `admin`
- ✅ Initialize config database at `./config.db`
- ✅ Add default application settings

### 2. Start Development Server

```bash
bun run dev
```

The application will be available at: http://localhost:4050

### 3. Login

Use the credentials displayed by the setup script:

```
Email:    admin@admin.com
Password: admin
```

## What Gets Created

### Main Database (`./data/`)

**PGLite-based PostgreSQL** containing:
- `users` - User accounts and authentication
- `roles` - User roles and permissions
- `user_roles` - User-to-role mappings
- `data_sources` - Database connections
- `saved_queries` - SQL queries
- `report_definitions` - Report configurations

### Configuration Database (`./config.db`)

**SQLite-based** persistent store containing:
- `data_sources_config` - Cached data source configurations
- `app_settings` - Application settings and preferences

### Databases Are Persistent

Both databases use file-based storage and persist across:
- ✅ Application restarts
- ✅ Dev server reloads
- ✅ System reboots (as long as files remain on disk)

## Admin User Details

Created by the setup script:

| Property | Value |
|----------|-------|
| Email | admin@admin.com |
| Password | admin |
| Display Name | System Administrator |
| Role | Administrator |
| Permissions | Full system access (`*:*`) |

### Password Reset

To change the admin password:

1. Login to the application
2. Navigate to Account Settings
3. Change password (feature to be implemented)

Or reset via database:

```bash
# Re-run setup to recreate with same password
bun run setup
```

## Environment Variables

Set in `.env.local`:

```bash
# Database locations
DATA_DIR=./data                    # PGLite database directory
CONFIG_DB_PATH=./config.db         # SQLite config database file

# Auth
AUTH_SECRET=<32+ char secret>      # JWT signing key
ENCRYPTION_KEY=<64-char hex>       # AES-256 key for credentials

# Other services
REDIS_URL=redis://localhost:6379   # Optional: for sessions
```

## Database Persistence

### PGLite (`./data/`)

- **Type**: In-process PostgreSQL
- **Persistence**: File-based (directory)
- **WAL**: Enabled for durability
- **Location**: `./data/` directory
- **Files**: 
  - `base/` - Data files
  - `pg_wal/` - Write-ahead logs
  - `global/` - System catalog

### Config DB (`./config.db`)

- **Type**: SQLite3
- **Persistence**: Single file
- **WAL**: Enabled (creates `.db-wal` and `.db-shm`)
- **Location**: `./config.db`
- **Related Files**:
  - `config.db-wal` - Write-ahead log
  - `config.db-shm` - Shared memory

## Clean Reset

To start fresh (lose all data):

```bash
# Delete databases
rm -rf ./data config.db config.db-wal config.db-shm

# Reinitialize
bun run setup
```

## Troubleshooting

### Admin user not created?

Check console output for errors during setup. The script is idempotent - running it again won't hurt:

```bash
bun run setup
```

### Can't login with admin credentials?

1. Verify admin user exists in database
2. Check password is exactly: `admin`
3. Try resetting: `bun run setup`

### Configuration disappearing?

1. Check `config.db` file exists: `ls -lh config.db`
2. Verify it's not being deleted by deployment scripts
3. Add to `.gitignore` to prevent deletion: `echo 'config.db*' >> .gitignore`

### Database corrupted?

```bash
# Back up current databases
cp -r ./data ./data.backup
cp config.db config.db.backup

# Delete and reset
rm -rf ./data config.db config.db-wal config.db-shm

# Reinitialize
bun run setup

# Data will be lost, but system will work again
```

## Architecture

```
┌─────────────────────────────────────────┐
│   Enterprise Reporting Application      │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  Main Database (PGLite)         │   │
│  │  → User accounts                │   │
│  │  → Reports, Charts, Dashboards  │   │
│  │  → Data sources, Queries        │   │
│  └─────────────────────────────────┘   │
│                │                        │
│                ├── ./data/              │
│                │   ├── base/            │
│                │   ├── pg_wal/          │
│                │   └── global/          │
│                │                        │
│  ┌─────────────────────────────────┐   │
│  │  Config Database (SQLite)       │   │
│  │  → Data source configs          │   │
│  │  → App settings                 │   │
│  └─────────────────────────────────┘   │
│                │                        │
│                ├── config.db            │
│                ├── config.db-wal        │
│                └── config.db-shm        │
│                                         │
└─────────────────────────────────────────┘
```

## Next Steps After Setup

1. ✅ Login with admin account
2. ⬜ Create data sources
3. ⬜ Write SQL queries
4. ⬜ Build reports and charts
5. ⬜ Create dashboards
6. ⬜ Invite users

## Support

For issues with setup or persistence:

1. Check logs: `tail -f dev-server.log`
2. Verify database files exist and are readable
3. Check disk space (both databases are small but need ~100MB free)
4. Review `.env.local` for correct paths

