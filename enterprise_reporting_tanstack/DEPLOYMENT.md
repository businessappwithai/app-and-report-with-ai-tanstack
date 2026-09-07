# Enterprise Reporting System - Deployment Guide

This guide covers deploying the Enterprise Reporting System to Hostinger using Docker Compose and Jenkins CI/CD.

## Prerequisites

### On Your Local Machine
- Docker and Docker Compose installed
- SSH access to Hostinger (SSH key pair)
- Git credentials for GitHub
- Docker Hub account (for image registry)

### On Hostinger VPS
- Ubuntu/Debian Linux
- Docker and Docker Compose installed
- SSH access configured
- DNS configured (if using custom domain)

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Jenkins Server                       │
│  (Runs CI/CD pipeline on code changes)                 │
└─────────┬───────────────────────────────────────────────┘
          │
          ├─→ Clone Repository
          ├─→ Build Docker Images
          ├─→ Test Services
          ├─→ Push to Docker Hub
          └─→ SSH Deploy to Hostinger
                │
                └─→ ┌──────────────────────────────────┐
                    │    Hostinger VPS (148.135.137.110)│
                    │                                   │
                    │  ┌────────────────────────────┐   │
                    │  │   Docker Compose Stack     │   │
                    │  ├────────────────────────────┤   │
                    │  │ • Nginx (SSL/TLS)          │   │
                    │  │ • App (Port 3000)          │   │
                    │  │ • Mastra (Port 4111)       │   │
                    │  │ • STT (Port 8081)          │   │
                    │  │ • MariaDB (Port 3306)      │   │
                    │  │ • Redis                    │   │
                    │  └────────────────────────────┘   │
                    └──────────────────────────────────┘
```

## Initial Setup

### 1. Prepare Hostinger Server

SSH into your Hostinger server:
```bash
ssh root@148.135.137.110
```

Install Docker and Docker Compose:
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
```

Create deployment directory:
```bash
mkdir -p /root/ers
cd /root/ers
```

### 2. Setup Jenkins Server

Run the provided Jenkins setup script:
```bash
./jenkins-deploy.sh
```

This will:
- Install Jenkins
- Install required plugins
- Create SSH keys
- Configure basic security

Access Jenkins at: `http://148.135.137.110:8080`
- Username: `admin`
- Password: `AdminPass123!`

### 3. Configure Jenkins Credentials

1. Go to **Jenkins Dashboard** → **Manage Jenkins** → **Manage Credentials**

2. Add SSH Key for Hostinger:
   - Click **Global credentials** → **Add Credentials**
   - Kind: `SSH Username with private key`
   - ID: `hostinger-ssh-key`
   - Username: `root`
   - Private Key: Paste your Hostinger SSH private key
   - Click **Create**

3. Add Docker Hub Credentials:
   - Kind: `Username with password`
   - ID: `docker-hub-credentials`
   - Username: Your Docker Hub username
   - Password: Your Docker Hub access token
   - Click **Create**

4. Add GitHub SSH Key (optional, if repo is private):
   - Kind: `SSH Username with private key`
   - ID: `github-ssh-key`
   - Username: `git`
   - Private Key: Your GitHub SSH key
   - Click **Create**

### 4. Create Jenkins Pipeline Job

1. Go to **Jenkins Dashboard** → **New Item**
2. Enter Job Name: `enterprise-reporting-deployment`
3. Select: **Pipeline**
4. Click **OK**

In the Pipeline section:
- Select: **Pipeline script from SCM**
- SCM: **Git**
- Repository URL: `https://github.com/yourusername/enterprise_reporting_tanstack.git`
- Branch: `*/main`
- Script Path: `Jenkinsfile`
- Click **Save**

### 5. Configure Environment Variables

On Hostinger, create `.env` file:
```bash
cd /root/ers
cat > .env << 'EOF'
# Application
NEXT_PUBLIC_APP_URL=https://your-domain.com
AUTH_SECRET=your-secret-key-here
AUTH_URL=https://your-domain.com

# Database
MARIADB_ROOT_PASSWORD=strong_root_password
MARIADB_DATABASE=enterprise_config
MARIADB_USER=enterprise
MARIADB_PASSWORD=strong_db_password

# Redis
REDIS_PASSWORD=strong_redis_password

# Encryption
ENCRYPTION_KEY=your-encryption-key-here

# AI Configuration
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o
AI_NL2SQL_API_KEY=sk-or-...

# Optional: Error Reporting
NEXT_PUBLIC_ERROR_REPORTING_EMAIL=admin@your-company.com
ERROR_REPORTING_EMAIL=admin@your-company.com
EOF

chmod 600 .env
```

## Deployment Workflows

### Automatic Deployment (GitHub Webhook)

1. In Jenkins Job → **Configure**
2. Under **Build Triggers**, enable:
   - ✅ **GitHub hook trigger for GITScm polling**

3. In GitHub Repository:
   - Go to **Settings** → **Webhooks** → **Add webhook**
   - Payload URL: `http://148.135.137.110:8080/github-webhook/`
   - Content type: `application/json`
   - Events: Push events, Pull request events
   - Click **Add webhook**

Now, every push to `main` will trigger the Jenkins pipeline automatically!

### Manual Deployment

Trigger the pipeline manually:
1. Go to Jenkins Dashboard
2. Click **enterprise-reporting-deployment**
3. Click **Build Now**
4. Monitor progress in the build logs

## Monitoring

### View Running Services
```bash
ssh root@148.135.137.110 "cd /root/ers && docker-compose ps"
```

### View Logs
```bash
ssh root@148.135.137.110 "cd /root/ers && docker-compose logs -f app"
```

### Check Application Health
```bash
curl http://148.135.137.110:3000/api/health
curl http://148.135.137.110:4111/health
```

### Stop/Start Services
```bash
# Stop
ssh root@148.135.137.110 "cd /root/ers && docker-compose down"

# Start
ssh root@148.135.137.110 "cd /root/ers && docker-compose up -d"
```

## Troubleshooting

### Container won't start
```bash
ssh root@148.135.137.110 "cd /root/ers && docker-compose logs app"
```

### Database connection issues
1. Check MariaDB is running: `docker-compose ps mariadb`
2. Verify credentials in `.env` match `docker-compose.yml`
3. Check MariaDB logs: `docker-compose logs mariadb`

### Images not found in Docker Hub
- Ensure Docker Hub credentials are correctly set in Jenkins
- Verify image names in Jenkinsfile match your Docker Hub namespace
- Manually push images: `docker push yourusername/enterprise-reporting-system:latest`

### SSH connection fails
1. Verify SSH key is in Jenkins credentials
2. Test SSH manually: `ssh -i /path/to/key root@148.135.137.110`
3. Check firewall isn't blocking port 22

## Rollback

If deployment goes wrong:
```bash
ssh root@148.135.137.110 << 'EOF'
cd /root/ers

# Restore from backup
docker-compose down
git checkout HEAD~1 docker-compose.yml

# Restart with previous version
docker-compose up -d

# Check status
docker-compose ps
EOF
```

## Updating Images

To rebuild and redeploy after code changes:

1. **Push to GitHub** (on main branch)
2. **GitHub webhook triggers Jenkins** automatically
3. **Jenkins pipeline:**
   - Pulls latest code
   - Builds new Docker images
   - Runs tests
   - Pushes to Docker Hub
   - Deploys to Hostinger
   - Verifies health

## Security Best Practices

✅ **Do:**
- Use strong passwords in `.env`
- Enable SSL/TLS with Let's Encrypt (configured in docker-compose.yml)
- Keep SSH keys secure
- Enable GitHub branch protection on main
- Regularly backup database: `docker-compose exec mariadb mysqldump -u root -p enterprise_config > backup.sql`

❌ **Don't:**
- Commit `.env` files to Git
- Share SSH keys
- Use default passwords
- Expose ports unnecessarily

## Next Steps

1. ✅ Configure environment variables on Hostinger (`.env`)
2. ✅ Set up Jenkins credentials
3. ✅ Create Jenkins pipeline job
4. ✅ Configure GitHub webhook (for auto-deployment)
5. ✅ Test manual deployment first
6. ✅ Monitor logs after first deployment
7. ✅ Set up automated backups
8. ✅ Configure monitoring/alerting

## Support

For issues, check:
- Jenkins logs: `tail -f /var/log/jenkins/jenkins.log`
- Docker logs: `docker-compose logs -f`
- Application health endpoints: `/api/health`
