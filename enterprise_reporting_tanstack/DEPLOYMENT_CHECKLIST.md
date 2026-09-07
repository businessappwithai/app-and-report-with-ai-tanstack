# Enterprise Reporting System — Deployment Checklist

## Pre-Deployment (On Your Local Machine)

### Repository Status
- [ ] All changes committed or stashed: `git status`
- [ ] Latest code from main branch: `git pull origin main`
- [ ] No uncommitted files that should be deployed

### Local Docker Verification
- [ ] All local containers running: `docker ps | grep ers-local`
- [ ] MariaDB is healthy and contains all data
- [ ] Redis is running and accessible
- [ ] STT service is operational
- [ ] Mastra server is running
- [ ] Main application accessible at http://localhost:5050

### Database Export
- [ ] Database dump created: `/tmp/enterprise_config_backup.sql`
- [ ] Dump file is valid: `wc -l /tmp/enterprise_config_backup.sql` (should be >100 lines)
- [ ] Dump file compressed for faster transfer: `/tmp/enterprise_config_backup.sql.gz`
- [ ] Backup location noted for later use

### Deployment Files Prepared
- [ ] `docker-compose.remote.yml` created
- [ ] `.env.remote.example` created with example values
- [ ] `DEPLOYMENT_GUIDE.md` reviewed
- [ ] `scripts/deploy-hostinger.sh` is executable
- [ ] `scripts/test-remote-deployment.sh` is executable

---

## Hostinger Server Setup (SSH as root)

### Server Prerequisites
- [ ] Hostinger VPS with sufficient resources:
  - [ ] Minimum 4GB RAM (8GB+ recommended)
  - [ ] Minimum 2 CPU cores
  - [ ] Minimum 30GB disk space
  - [ ] Outbound internet access (for API calls, container pulls)

### Docker Installation
```bash
# Run these commands on Hostinger server
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
docker --version  # Verify installation
docker compose version  # Verify Docker Compose
```
- [ ] Docker installed and running
- [ ] Docker Compose installed (version 2.x or higher)
- [ ] User can run docker commands without sudo

### System Preparation
- [ ] Server firewall allows ports: 22 (SSH), 80 (HTTP), 443 (HTTPS), 3000 (app), 4111 (Mastra)
- [ ] DNS records configured (if using custom domain)
- [ ] System time is synchronized: `date` and `timedatectl`
- [ ] Sufficient disk space: `df -h /`

---

## Deployment Phase

### Step 1: Prepare Remote Environment
```bash
# On your local machine
HOSTINGER_IP="your.server.ip"
./scripts/deploy-hostinger.sh $HOSTINGER_IP root 22
```

- [ ] SSH connection to Hostinger server successful
- [ ] Docker and Docker Compose verified on server
- [ ] Local database exported
- [ ] All files synced to `/root/ers`
- [ ] `.env` file created from template

### Step 2: Configure Environment Variables
```bash
# SSH to Hostinger and edit .env
ssh root@YOUR_HOSTINGER_IP
cd /root/ers
nano .env
```

- [ ] `NEXT_PUBLIC_APP_URL` updated (your domain or IP)
- [ ] `AUTH_URL` set correctly
- [ ] `AUTH_SECRET` set (keep local value or generate new)
- [ ] `ENCRYPTION_KEY` set (keep local value or generate new)
- [ ] `MARIADB_*` values match local configuration (critical!)
- [ ] `AI_NL2SQL_API_KEY` set to valid OpenRouter API key
- [ ] `REDIS_PASSWORD` set securely
- [ ] All required fields populated

### Step 3: Deploy Containers
```bash
cd /root/ers
docker compose -f docker-compose.remote.yml up -d --build
```

- [ ] Build process completed without errors
- [ ] All containers started: `docker ps | grep ers-remote`
- [ ] Containers pass initial health checks
- [ ] No port conflicts (3000, 3306, 4111, 6379, 8081 available)

### Step 4: Import Database
```bash
cd /root/ers
docker exec ers-remote-mariadb mysql -u enterprise -penterprise_pass enterprise_config < enterprise_config_backup.sql
```

- [ ] Database import completed without errors
- [ ] Tables imported: `docker exec ers-remote-mariadb mysql -u enterprise -penterprise_pass enterprise_config -e "SHOW TABLES;" | wc -l` (should match local)
- [ ] Data sample verified: Check key tables exist with data
- [ ] No collation warnings or errors

---

## Post-Deployment Testing

### Basic Connectivity Tests
```bash
# From your local machine
./scripts/test-remote-deployment.sh $HOSTINGER_IP root 22
```

- [ ] SSH connectivity verified
- [ ] All containers healthy/running
- [ ] MariaDB responding with correct table count
- [ ] Redis PING responding PONG
- [ ] STT service responding to /health
- [ ] Mastra server responding to /health
- [ ] Application API responding at /api/health
- [ ] Web server responding on port 3000

### Application Functionality Tests
```bash
# In browser
http://YOUR_HOSTINGER_IP:3000
```

- [ ] Application loads without errors
- [ ] Login page accessible
- [ ] Dashboard loads
- [ ] Can view data sources
- [ ] Can navigate between pages
- [ ] No console errors (check browser DevTools)

### NL-to-SQL Pipeline Tests
- [ ] Navigate to `/nl-query` page
- [ ] Submit a natural language query
- [ ] Query is processed by Mastra
- [ ] SQL is generated correctly
- [ ] Results are displayed
- [ ] Voice input works (STT service responding)

### Database & Cache Tests
- [ ] Create a new user/entity via UI
- [ ] Data persists after refresh
- [ ] Can query new data from database
- [ ] Redis cache operations work
- [ ] Export functionality works

---

## Optional: Production Hardening

### Nginx Reverse Proxy & SSL
```bash
# Install Nginx and Let's Encrypt
apt-get update
apt-get install -y nginx certbot python3-certbot-nginx

# Configure Nginx (reverse proxy to port 3000)
# Create config at /etc/nginx/sites-available/ers

# Get SSL certificate
certbot --nginx -d your-domain.com

# Restart Nginx
systemctl restart nginx
```

- [ ] Nginx installed and configured
- [ ] SSL certificate obtained
- [ ] Application accessible via HTTPS
- [ ] HTTP redirects to HTTPS
- [ ] Certificate auto-renewal configured

### Monitoring & Logging
```bash
# Check logs regularly
docker compose -f docker-compose.remote.yml logs -f

# Monitor resource usage
docker stats
```

- [ ] Log rotation configured (Docker default: 10 logs, 100MB each)
- [ ] Monitor disk usage: `df -h /root/ers`
- [ ] Set up alerts for container crashes
- [ ] Document escalation contacts

### Backups
```bash
# Create backup script
nano /root/ers/backup.sh

# Schedule with cron
crontab -e
# 0 2 * * * /root/ers/backup.sh
```

- [ ] Automated database backup script created
- [ ] Backups scheduled daily (off-peak hours)
- [ ] Backup storage location secured (separate disk or cloud)
- [ ] Backup retention policy defined (30 days minimum)
- [ ] Restore procedure tested

### Security Hardening
- [ ] Firewall rules configured (block unnecessary ports)
- [ ] SSH key-based authentication only (no passwords)
- [ ] Fail2ban configured for brute-force protection
- [ ] Keep-alive monitoring for containers (healthchecks)
- [ ] Consider WAF for DDoS protection

---

## Troubleshooting

### Container Startup Issues
```bash
# Check detailed logs
docker logs ers-remote-app
docker logs ers-remote-mariadb
docker logs ers-remote-mastra

# Check compose status
docker compose -f docker-compose.remote.yml logs
```

- [ ] Review logs for specific errors
- [ ] Check environment variables: `docker exec ers-remote-app env | grep -i "mariadb\|redis\|mastra"`
- [ ] Verify port availability: `netstat -tlnp | grep -E "3000|3306|4111|6379|8081"`

### Database Connection Issues
```bash
# Test from app container
docker exec ers-remote-app mysql -h mariadb -u enterprise -penterprise_pass enterprise_config -e "SHOW TABLES;"

# Test from local machine (if port exposed)
mysql -h YOUR_HOSTINGER_IP -P 3306 -u enterprise -penterprise_pass enterprise_config -e "SELECT 1;"
```

- [ ] Verify MariaDB container is healthy
- [ ] Check network connectivity: `docker network ls` and `docker network inspect ers-network`
- [ ] Re-import database if tables missing
- [ ] Check character set: `SHOW CREATE TABLE table_name;`

### API Connection Issues
```bash
# Test from app container
docker exec ers-remote-app curl -v http://mariadb:3306

# Check Redis
docker exec ers-remote-app redis-cli -h redis ping
```

- [ ] Verify all services have correct internal hostnames
- [ ] Check Docker network for service discovery
- [ ] Review application logs for specific errors
- [ ] Test connectivity with curl/telnet

### Performance Issues
```bash
# Monitor real-time stats
watch docker stats

# Check disk usage
du -sh .docker-data/*

# Check memory pressure
free -h
```

- [ ] Increase container resource limits if needed
- [ ] Check disk space: `df -h /`
- [ ] Monitor query performance: Enable slow query log
- [ ] Consider database optimization/indexing
- [ ] Review Mastra logs for AI model performance

---

## Verification Checklist

### Before Going Live
- [ ] All tests pass without errors or warnings
- [ ] Application loads quickly (<2 seconds)
- [ ] Database queries respond quickly (<1 second for typical operations)
- [ ] NL-to-SQL pipeline works end-to-end
- [ ] Voice features (STT) functional if enabled
- [ ] Error messages are user-friendly
- [ ] Logs don't show warnings or errors
- [ ] Resource usage is acceptable (CPU <50%, Memory <75%)
- [ ] No hardcoded localhost references
- [ ] All secrets properly managed (no .env in git)

### User Acceptance Testing
- [ ] Admin can log in successfully
- [ ] Admin can create data sources
- [ ] Admin can view reports
- [ ] Users with proper roles can execute queries
- [ ] Users without permissions get proper error messages
- [ ] Exports work correctly
- [ ] Voice transcription works (if applicable)
- [ ] Dashboard loads with current data

---

## Launch Day

### Final Checks (1 hour before launch)
```bash
# Full system status check
docker compose -f docker-compose.remote.yml ps
docker stats
df -h /

# Backup current database
./backup.sh
```

- [ ] All containers healthy
- [ ] Resource usage acceptable
- [ ] Recent backup exists
- [ ] Team ready to monitor

### Monitoring Plan
- [ ] Error monitoring configured (alerts for failures)
- [ ] Performance monitoring active (response times, resource usage)
- [ ] Team on standby for first 24 hours
- [ ] Runbook prepared for common issues
- [ ] Escalation contacts documented

---

## Post-Launch

### Day 1 (24-Hour Window)
- [ ] Monitor application logs continuously
- [ ] Watch for database connection errors
- [ ] Monitor CPU and memory usage
- [ ] Verify backup completed successfully
- [ ] Check for user-reported issues
- [ ] Document any unexpected behavior

### Week 1
- [ ] All systems stable
- [ ] No critical errors in logs
- [ ] Database performance satisfactory
- [ ] Backup and restore procedures tested
- [ ] Team trained on operational procedures

### Ongoing
- [ ] Weekly log review for warnings
- [ ] Monthly backup verification
- [ ] Quarterly security audit
- [ ] Document lessons learned
- [ ] Plan for scaling if needed

---

## Emergency Contacts & Escalation

```
Application Owner: [Name, Email, Phone]
Database Administrator: [Name, Email, Phone]
DevOps/Infrastructure: [Name, Email, Phone]
24/7 On-Call: [Name, Email, Phone]
Hostinger Support: [Ticket Link, Phone]
```

---

## Sign-Off

- [ ] Deployment Lead: __________ Date: __________
- [ ] QA Approval: __________ Date: __________
- [ ] Operations Approval: __________ Date: __________
- [ ] Business Approval: __________ Date: __________

---

**Document Version:** 1.0
**Last Updated:** 2026-06-06
**Next Review:** After first successful deployment
