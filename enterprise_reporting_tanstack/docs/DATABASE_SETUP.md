# Database Configuration Guide

This project supports both **PGLite** (development) and **PostgreSQL** (production) databases.

## Development (Default) - PGLite

PGLite is an in-process PostgreSQL database that doesn't require any external server.

### Setup
```bash
# Run migrations to create tables
bun run db:migrate

# The database is created at ./data directory
ls -la ./data
```

### Environment Variables
```bash
# (Optional) Custom data directory
DATA_DIR=./custom-data-path
```

## Production - PostgreSQL

Switch to PostgreSQL for production deployments.

### Prerequisites
- PostgreSQL 14+ server
- Database and credentials set up

### Setup

1. **Install pgvector extension** (for vector embeddings):
   ```bash
   # On macOS with Homebrew
   brew install pgvector
   
   # Or build from source
   git clone --branch v0.7.0 https://github.com/pgvector/pgvector.git
   cd pgvector
   make
   make install
   
   # Restart PostgreSQL after installation
   brew services restart postgresql
   ```

2. **Create PostgreSQL database and user**:
   ```sql
   CREATE DATABASE enterprise_reporting;
   CREATE USER app_user WITH PASSWORD 'secure_password';
   GRANT ALL PRIVILEGES ON DATABASE enterprise_reporting TO app_user;
   
   -- Enable pgvector extension
   \c enterprise_reporting
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

2. **Set environment variables**:
   ```bash
   DATABASE_TYPE=postgres
   DATABASE_URL=postgresql://app_user:secure_password@localhost:5432/enterprise_reporting
   ```

3. **Run migrations** (same command works for both):
   ```bash
   bun run db:migrate
   ```

   This will use the PostgreSQL connection string to create all tables.

### Connection String Format
```
postgresql://[user[:password]@][host][:port][/database][?param=value&...]
```

Examples:
- Local: `postgresql://postgres:password@localhost:5432/enterprise_reporting`
- AWS RDS: `postgresql://user:pass@your-db.region.rds.amazonaws.com:5432/enterprise_reporting`
- Heroku: `postgresql://user:pass@ec2-123-45-67-89.compute-1.amazonaws.com:5432/database`

## Features with Vector Embeddings

Both databases support **pgvector-compatible embeddings**:

- Logs are stored with `message_vector` column (TEXT format with JSON arrays)
- Semantic similarity search: `/api/logs/search`
- Cosine similarity calculation for finding related logs
- Compatible with Mastra.ai for AI-powered analysis

## Switching Databases

To switch from development to production:

```bash
# Before migration (backup your PGLite data)
cp -r ./data ./data.backup

# Set production database
export DATABASE_TYPE=postgres
export DATABASE_URL=postgresql://...

# Run migrations (creates tables in PostgreSQL)
bun run db:migrate

# Verify tables are created
psql $DATABASE_URL -c "\dt"
```

## Data Migration from PGLite to PostgreSQL

To migrate existing data:

1. **Export from PGLite**:
   ```bash
   # Use pg_dump on the PGLite data
   sqlite3 ./data/app.db ".dump" > backup.sql
   ```

2. **Import to PostgreSQL**:
   ```bash
   psql $DATABASE_URL < backup.sql
   ```

## Development vs Production

| Feature | PGLite | PostgreSQL |
|---------|--------|------------|
| Setup   | Zero config | Requires server |
| Data Location | ./data directory | External server |
| Performance | Good for dev | Production-grade |
| Concurrency | Single process | Multi-connection |
| Scalability | Local only | Horizontally scalable |
| Backups | Copy ./data | pg_dump / native backups |
| Vector Search | JSON arrays | pgvector extension (optional) |

## Environment Variables Summary

```bash
# Database selection
DATABASE_TYPE=pglite          # (default) Use PGLite in-process
DATABASE_TYPE=postgres        # Use external PostgreSQL

# PostgreSQL connection (required if DATABASE_TYPE=postgres)
DATABASE_URL=postgresql://user:pass@host:port/database

# PGLite data directory
DATA_DIR=./data              # (default) Custom path for PGLite data

# Logging level
LOG_LEVEL=info              # pino log level
```

## Troubleshooting

### "database does not exist"
- Ensure PostgreSQL database is created
- Check DATABASE_URL is correct
- Run migrations: `bun run db:migrate`

### "connection refused"
- Check PostgreSQL is running: `psql -c "SELECT 1"`
- Verify host/port/credentials in DATABASE_URL
- Check firewall rules allow connection

### "type 'vector' does not exist"
- PGLite doesn't have pgvector extension
- Message vectors are stored as JSON arrays instead
- Vector similarity search works with cosine similarity calculations

## Production Deployment

For Docker/Kubernetes deployments:

```dockerfile
FROM oven/bun:latest

WORKDIR /app
COPY . .

ENV DATABASE_TYPE=postgres
ENV NODE_ENV=production

RUN bun install
RUN bun run db:migrate

CMD ["bun", "run", "start"]
```

Ensure `DATABASE_URL` is set in your deployment environment (via secrets/ConfigMap).
