# Hostinger Deployment — Complete Index

**Status**: ✅ Ready for deployment  
**Last Updated**: 2026-06-06  
**Version**: 1.0

## 📋 Quick Navigation

Start here based on your experience level:

### 🚀 **5-Minute Express Deploy** (For experienced DevOps)
→ Read: **QUICK_START_DEPLOYMENT.md**
- Automated bash script handles 80% of setup
- Manual configuration of 3-4 env variables
- ~15 minutes total including container builds

### 📖 **Full Deployment Guide** (For careful deployments)
→ Read: **DEPLOYMENT_GUIDE.md**
- Step-by-step instructions with explanations
- Troubleshooting section for common issues
- Best practices for production setup

### ☑️ **Pre-Flight Checklist** (Before launching)
→ Use: **DEPLOYMENT_CHECKLIST.md**
- Pre-deployment verification on local machine
- Server prerequisites validation
- Post-deployment sign-off

---

## 📦 Deployment Files

### Configuration Files

| File | Purpose | Status |
|------|---------|--------|
| `docker-compose.remote.yml` | Container orchestration for Hostinger | ✅ Ready |
| `.env.remote.example` | Environment variables template | ✅ Ready |
| `.env.local` | Local development config (reference) | ✅ Reference |
| `.env.mastra` | Mastra AI server config | ✅ Reference |

### Documentation

| File | Content | Read Time |
|------|---------|-----------|
| `QUICK_START_DEPLOYMENT.md` | 5-minute quick reference | 5 min |
| `DEPLOYMENT_GUIDE.md` | Comprehensive step-by-step guide | 20 min |
| `DEPLOYMENT_CHECKLIST.md` | Pre/post deployment checklist | 10 min |
| `HOSTINGER_DEPLOYMENT_INDEX.md` | This file | 5 min |

### Scripts (Executable)

| Script | Purpose | Requires |
|--------|---------|----------|
| `scripts/deploy-hostinger.sh` | Automated deployment to Hostinger | SSH access |
| `scripts/test-remote-deployment.sh` | Comprehensive deployment testing | SSH access |

### Database

| File | Description | Size |
|------|-------------|------|
| `/tmp/enterprise_config_backup.sql` | Local MariaDB database dump | 1.8 MB |
| `/tmp/enterprise_config_backup.sql.gz` | Compressed database dump | ~300 KB |

---

## 🎯 Deployment Architecture

```
Local Machine (You)
├── Database Dump
├── Source Code
├── Docker Compose Files
└── Deployment Scripts
    │
    ↓ (SSH + rsync + scp)
    │
Hostinger VPS
├── Docker Engine
├── Docker Compose
├── Application Code
├── Database Container
├── Redis Container
├── STT Container (whisper.cpp)
├── Mastra AI Container
└── TanStack Start Application
```

---

## 🔄 Deployment Flow

### Phase 1: Preparation (Local Machine)
```
✅ Export MariaDB database
✅ Verify all containers running locally
✅ Prepare environment variables
✅ Test database export integrity
```

### Phase 2: Transfer
```
✅ Create remote directory structure
✅ Sync source code to Hostinger
✅ Transfer database dump
✅ Copy configuration files
```

### Phase 3: Deployment
```
✅ Configure .env on remote server
✅ Build Docker images
✅ Start containers
✅ Import database
```

### Phase 4: Validation
```
✅ Run health checks
✅ Verify database integrity
✅ Test API endpoints
✅ Confirm NL-to-SQL pipeline
```

---

## 🖥️ Server Requirements

### Minimum
- **RAM**: 4 GB
- **CPU**: 2 cores
- **Disk**: 30 GB (20 GB for Docker images + volumes)
- **OS**: Ubuntu 20.04+ or similar Linux distro
- **Docker**: 20.10+
- **Docker Compose**: 2.0+

### Recommended
- **RAM**: 8 GB
- **CPU**: 4 cores
- **Disk**: 50 GB
- **Network**: 100 Mbps+ dedicated connection
- **Uptime**: 99.9% SLA

---

## 🔐 Security Checklist

Before deploying to production:

- [ ] Change `AUTH_SECRET` to a new secure value
- [ ] Change `ENCRYPTION_KEY` to a new secure value
- [ ] Set strong `MARIADB_ROOT_PASSWORD`
- [ ] Set strong `REDIS_PASSWORD`
- [ ] Enable SSL/TLS with Nginx (see guide)
- [ ] Configure firewall rules
- [ ] Set up automated database backups
- [ ] Enable log rotation
- [ ] Configure monitoring and alerts

---

## 🚀 Quick Start Commands

### Copy & paste for experienced deployments:

```bash
# 1. Export database
mysqldump -h 127.0.0.1 -P 3307 -u enterprise -penterprise_pass \
  enterprise_config > /tmp/enterprise_config_backup.sql

# 2. Deploy (replace IP)
./scripts/deploy-hostinger.sh 192.168.1.100 root 22

# 3. Configure
ssh root@192.168.1.100
cd /root/ers && nano .env
# Update: NEXT_PUBLIC_APP_URL, AUTH_URL, AI_NL2SQL_API_KEY

# 4. Restart
docker compose -f docker-compose.remote.yml restart

# 5. Test
exit  # Return to local machine
./scripts/test-remote-deployment.sh 192.168.1.100 root 22
```

---

## 📊 Container Details

### Enterprise Reporting System (Main App)
- **Image**: `enterprise-reporting-system:latest`
- **Port**: 3000
- **Tech**: TanStack Start, Node.js
- **Features**: Web UI, API, report generation
- **Health Check**: `/api/health`

### Mastra AI Agent Server
- **Image**: `ers-mastra:latest`
- **Port**: 4111
- **Purpose**: NL-to-SQL query generation, AI-powered automation
- **Health Check**: `/health`

### Speech-to-Text (STT) Service
- **Image**: `ers-stt:latest`
- **Port**: 8081
- **Model**: whisper.cpp (tiny.en)
- **Purpose**: Voice transcription for queries
- **Health Check**: `/health`

### MariaDB 11
- **Image**: `mariadb:11`
- **Port**: 3306 (internal only in production)
- **Database**: `enterprise_config`
- **Purpose**: Configuration and metadata storage
- **Health Check**: `healthcheck.sh`

### Redis 7
- **Image**: `redis:7-alpine`
- **Port**: 6379 (internal only in production)
- **Purpose**: Job queue, caching, session storage
- **Health Check**: `redis-cli ping`

---

## 🔍 Testing & Monitoring

### Immediate After Deployment
Run the test script:
```bash
./scripts/test-remote-deployment.sh YOUR_IP
```

Expected result: ✓ All tests passed!

### Daily Monitoring
```bash
# Container status
ssh root@YOUR_IP "docker ps | grep ers-remote"

# View logs
ssh root@YOUR_IP "docker compose -f /root/ers/docker-compose.remote.yml logs"

# Resource usage
ssh root@YOUR_IP "docker stats"
```

### Regular Backups
```bash
# Daily automatic backup (add to crontab)
0 2 * * * docker exec ers-remote-mariadb mysqldump \
  -u enterprise -penterprise_pass enterprise_config > \
  /root/ers/backups/db_$(date +\%Y\%m\%d).sql
```

---

## 🛠️ Common Operations

### Restart All Services
```bash
ssh root@YOUR_IP
cd /root/ers
docker compose -f docker-compose.remote.yml restart
```

### View Application Logs
```bash
ssh root@YOUR_IP
docker logs -f ers-remote-app --tail=100
```

### Access Database Directly
```bash
# From remote server
ssh root@YOUR_IP
docker exec -it ers-remote-mariadb mysql -u enterprise -penterprise_pass enterprise_config

# From local machine (if port exposed)
mysql -h YOUR_IP -u enterprise -penterprise_pass enterprise_config
```

### Backup Database Manually
```bash
ssh root@YOUR_IP
docker exec ers-remote-mariadb mysqldump -u enterprise -penterprise_pass \
  enterprise_config > /root/ers/backups/manual_backup_$(date +%Y%m%d_%H%M%S).sql
```

### Update Docker Images
```bash
ssh root@YOUR_IP
cd /root/ers
docker compose -f docker-compose.remote.yml pull
docker compose -f docker-compose.remote.yml up -d --build
```

---

## 🆘 Troubleshooting

### Issue: Containers Not Starting
**Solution**: Check logs and ensure ports are available
```bash
docker compose -f docker-compose.remote.yml logs
netstat -tlnp | grep 3000
```

### Issue: Database Connection Errors
**Solution**: Verify MariaDB is healthy and database imported
```bash
docker exec ers-remote-mariadb mysql -u enterprise -penterprise_pass \
  enterprise_config -e "SHOW TABLES;" | wc -l
```

### Issue: App Can't Connect to Mastra
**Solution**: Verify Mastra is healthy
```bash
docker exec ers-remote-app curl http://mastra:4111/health
```

**See full troubleshooting section** in `DEPLOYMENT_GUIDE.md`

---

## 📞 Support & Resources

- **Hostinger Docs**: https://hostinger.com/help
- **Docker Docs**: https://docs.docker.com
- **MariaDB Docs**: https://mariadb.com/docs
- **TanStack Start**: https://tanstack.com/start

---

## 📝 Deployment Record

Document your deployment details here for future reference:

```
Deployment Date: _______________
Server IP/Domain: _______________
Admin Email: _______________
AI API Key Provider: _______________
Backup Location: _______________
SSL Certificate: _______________
Monitoring Tool: _______________
On-Call Contact: _______________
```

---

## ✅ Deployment Success Criteria

After deployment, verify:

- [ ] All 5 containers running and healthy
- [ ] Application loads at `http://YOUR_IP:3000`
- [ ] Database contains all tables from export
- [ ] NL-to-SQL pipeline works end-to-end
- [ ] No console errors in browser DevTools
- [ ] API health check responds at `/api/health`
- [ ] Resource usage acceptable (CPU <50%, Memory <75%)
- [ ] Recent database backup exists
- [ ] Monitoring/alerting configured
- [ ] Team trained on operations

---

**Ready to deploy?** Start with:
1. `QUICK_START_DEPLOYMENT.md` (if experienced)
2. `DEPLOYMENT_GUIDE.md` (if careful)
3. `DEPLOYMENT_CHECKLIST.md` (before going live)

🎉 **Happy deploying!**
