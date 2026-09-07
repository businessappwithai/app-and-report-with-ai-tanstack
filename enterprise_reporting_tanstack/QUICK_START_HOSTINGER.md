# Quick Start: Deploy to Hostinger

This guide gets your Enterprise Reporting System running on Hostinger in 5 minutes.

## Prerequisites

- Hostinger account with VPS (148.135.137.110)
- SSH access to Hostinger
- Docker Hub account (for pushing images)
- GitHub account (for your repository)

## ⚡ Quick Deploy (5 steps)

### Step 1: SSH into Hostinger
```bash
ssh root@148.135.137.110
```

### Step 2: Clone and setup
```bash
mkdir -p /root/ers
cd /root/ers
git clone https://github.com/yourusername/enterprise_reporting_tanstack.git .
```

### Step 3: Configure environment
```bash
# Copy the example environment file
cp .env.hostinger .env

# Edit with your values
nano .env
```

**Required changes in `.env`:**
- `NEXT_PUBLIC_APP_URL` → Your domain (e.g., https://reports.example.com)
- `AUTH_SECRET` → Generate: `openssl rand -hex 32`
- `MARIADB_ROOT_PASSWORD` → Strong password
- `MARIADB_PASSWORD` → Strong password
- `REDIS_PASSWORD` → Strong password
- `ENCRYPTION_KEY` → Generate: `openssl rand -hex 32`
- `OPENAI_API_KEY` → Your OpenAI key

### Step 4: Start Docker Compose
```bash
docker-compose up -d

# Wait for services to start
docker-compose logs -f

# Check status
docker-compose ps
```

### Step 5: Verify
```bash
curl http://localhost:3000/api/health
```

✅ **Done!** Your app is running.

---

## 🔄 Using the Deployment Helper

For easier management, use the provided helper script:

```bash
# Check status
./hostinger-deploy.sh status

# View logs
./hostinger-deploy.sh logs app
./hostinger-deploy.sh logs mastra

# Deploy new version
./hostinger-deploy.sh deploy

# Health checks
./hostinger-deploy.sh health

# Backup database
./hostinger-deploy.sh backup

# Restore from backup
./hostinger-deploy.sh restore enterprise_config_backup_20240101_120000.sql
```

---

## 🤖 Setting Up Jenkins CI/CD (Optional)

For automatic deployments on every Git push:

### 1. Install Jenkins
```bash
# On a Jenkins server or Hostinger:
./jenkins-deploy.sh
```

### 2. Configure Jenkins Credentials
1. Go to `http://148.135.137.110:8080`
2. Login: admin / AdminPass123!
3. **Manage Jenkins** → **Manage Credentials** → **Global** → **Add Credentials**

Add three credentials:
- **hostinger-ssh-key** (SSH key for Hostinger)
- **docker-hub-credentials** (Docker Hub username/password)
- **github-ssh-key** (Optional, for private repos)

### 3. Create Pipeline Job
1. **New Item** → Name: `enterprise-reporting-deployment`
2. Type: **Pipeline**
3. Pipeline → **Pipeline script from SCM**
4. SCM: **Git**
5. Repository: `https://github.com/yourusername/enterprise_reporting_tanstack.git`
6. Script Path: `Jenkinsfile`
7. **Save**

### 4. Enable GitHub Webhook
In your GitHub repo:
- **Settings** → **Webhooks** → **Add webhook**
- Payload URL: `http://148.135.137.110:8080/github-webhook/`
- Content type: `application/json`
- Events: Push, Pull requests
- **Add webhook**

Now every push to `main` will automatically:
1. Build Docker images
2. Run tests
3. Push to Docker Hub
4. Deploy to Hostinger

---

## 📊 Accessing Your Application

- **Main App**: http://148.135.137.110:3000
- **Mastra AI**: http://148.135.137.110:4111
- **STT Service**: http://148.135.137.110:8081
- **Jenkins** (if set up): http://148.135.137.110:8080

---

## 🔒 Setting Up SSL (Let's Encrypt)

The `docker-compose.yml` includes automatic SSL setup. To enable:

1. Edit `.env` and set:
   ```env
   DOMAIN=your-domain.com
   SSL_EMAIL=your-email@example.com
   ```

2. Update Nginx config at `/srv/enterprise-reporting-system/nginx/conf.d/default.conf`

3. Restart containers:
   ```bash
   docker-compose down
   docker-compose up -d
   ```

---

## 🆘 Troubleshooting

### Check what's running
```bash
docker-compose ps
```

### View logs
```bash
docker-compose logs -f [service-name]
# Examples: app, mariadb, redis, mastra, stt
```

### Restart everything
```bash
docker-compose down
docker-compose up -d
```

### Check database connection
```bash
docker-compose exec mariadb mysql -u enterprise -p -e "SELECT 1;"
```

### Check Redis connection
```bash
docker-compose exec redis redis-cli ping
```

### Rebuild images
```bash
docker-compose build --no-cache
docker-compose up -d
```

---

## 📚 Full Documentation

For detailed setup, troubleshooting, and advanced configuration:
- Read: `DEPLOYMENT.md`

For information about Jenkins pipeline:
- Read: `Jenkinsfile`

For deployment script options:
- Run: `./hostinger-deploy.sh help`

---

## 🚀 Next Steps

1. ✅ Get app running with Docker Compose
2. ✅ Configure your domain and SSL
3. ✅ Set up automated backups
4. ✅ Configure Jenkins for CI/CD
5. ✅ Set up monitoring/alerting
6. ✅ Create a deployment runbook for your team

---

## 📞 Support

For issues:
1. Check logs: `docker-compose logs -f`
2. Read `DEPLOYMENT.md` troubleshooting section
3. Check container health: `./hostinger-deploy.sh health`
