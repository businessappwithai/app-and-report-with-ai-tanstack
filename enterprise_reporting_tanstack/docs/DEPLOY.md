# Deployment Guide

Enterprise Reporting System deployment on Hostinger VPS with Docker Compose.

For detailed deployment guide, see [docs/DOCKER_HOSTINGER_DEPLOYMENT.md](DOCKER_HOSTINGER_DEPLOYMENT.md).

## Quick Deployment Summary

This system uses:
- **SQLite** for application database (embedded, zero configuration)
- **Redis** for BullMQ job queue backend
- **Nginx** for reverse proxy and SSL
- **Bun** runtime for TanStack Start application

### Prerequisites

- Hostinger VPS: 2GB+ RAM, 20GB+ storage, Ubuntu 20.04+
- SSH root access
- Domain name (optional, for SSL)
- Docker & Docker Compose installed

### Quick Steps

1. **Clone repository** on VPS
2. **Configure `.env`** with your values
3. **Run migrations**: `bun run db:migrate && bun run db:sample`
4. **Start services**: `docker compose up -d`
5. **Verify**: `curl https://your-domain.com/api/health`

## Data Storage

All data persists on VPS filesystem at `/srv/enterprise-reporting-system/`:

```
/srv/enterprise-reporting-system/
├── redis/data/        # Redis snapshots (for BullMQ)
├── app/
│   ├── data/          # SQLite database (config.sqlite)
│   ├── job-outputs/   # Generated reports/exports
│   ├── uploads/       # User files
│   └── logs/          # Application logs
└── backups/           # Backup archives
```

## Backup & Restore

### Manual Backup

```bash
cd /srv/enterprise-reporting-system
tar -czf backup-$(date +%Y%m%d).tar.gz postgres/ redis/ app/

# Download to local
scp root@your-vps-ip:/srv/enterprise-reporting-system/backup-*.tar.gz ./
```

### Database Backup

```bash
# PostgreSQL dump
docker exec ers-postgres pg_dump -U ersuser enterprise_reporting > backup.sql

# Restore
docker exec -i ers-postgres psql -U ersuser enterprise_reporting < backup.sql
```

### Restore from Backup

```bash
# Stop containers
docker compose down

# Extract backup
tar -xzf backup-20240101.tar.gz -C /srv/enterprise-reporting-system/

# Start containers
docker compose up -d
```

## Common Commands

```bash
# View running containers
docker compose ps

# View logs
docker compose logs -f app

# Restart services
docker compose restart

# Rebuild and restart
docker compose down
docker compose up -d --build

# Update application
git pull
docker compose down
docker compose up -d --build
```

## Troubleshooting

### Container won't start

```bash
# Check logs
docker compose logs <service-name>

# Check disk space
df -h

# Check memory
free -h
```

### Permission issues

```bash
# Fix PostgreSQL permissions
chown -R 999:999 /srv/enterprise-reporting-system/postgres

# Fix app permissions
chown -R 1000:1000 /srv/enterprise-reporting-system/app
```

### Database connection

```bash
# Test PostgreSQL
docker exec ers-postgres psql -U ersuser -d enterprise_reporting -c "SELECT 1;"

# Check Redis
docker exec ers-redis redis-cli ping
```

## Security Checklist

- [ ] Changed all default passwords
- [ ] Generated secure AUTH_SECRET
- [ ] Generated secure ENCRYPTION_KEY
- [ ] Set strong POSTGRES_PASSWORD
- [ ] Set strong REDIS_PASSWORD
- [ ] Enabled firewall: `ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw enable`
- [ ] Configured SSL (Let's Encrypt)
- [ ] Set up automated backups

## SSL Configuration

```bash
# Install Certbot
apt-get install certbot python3-certbot-nginx

# Get certificate
certbot --nginx -d your-domain.com

# Auto-renewal is configured
certbot renew --dry-run
```

## Default Credentials

- Email: `admin@admin.com`
- Password: `admin`
- **CHANGE IMMEDIATELY AFTER FIRST LOGIN**

## Support URLs

- Application: `https://your-domain.com`
- API health: `https://your-domain.com/api/health`

See `DOCKER_HOSTINGER_DEPLOYMENT.md` for complete architecture details.
