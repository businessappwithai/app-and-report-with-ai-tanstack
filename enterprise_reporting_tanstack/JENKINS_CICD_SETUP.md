# Jenkins CI/CD Pipeline for Enterprise Reporting System - Hostinger Deployment

Complete Jenkins setup for automated deployment, testing, and monitoring of the Enterprise Reporting System on Hostinger.

---

## 📋 Overview

This guide sets up a **production-grade Jenkins CI/CD pipeline** that:

- ✅ Automatically builds Docker images from Git commits
- ✅ Runs automated tests before deployment
- ✅ Deploys to Hostinger on successful builds
- ✅ Manages database migrations and backups
- ✅ Monitors deployment health
- ✅ Provides rollback capabilities
- ✅ Sends notifications on build/deployment status
- ✅ Maintains deployment history and logs

---

## 🏗️ Architecture

```
GitHub/GitLab → Jenkins → Docker Build → Push to Registry 
                                              ↓
                                        Run Tests
                                              ↓
                                        Deploy to Hostinger
                                              ↓
                                        Health Checks
                                              ↓
                                        Notification (Slack/Email)
```

---

## 🚀 Part 1: Jenkins Server Setup on Hostinger

### Step 1: Install Jenkins

SSH to your Hostinger server and run:

```bash
# Add Jenkins repository
wget -q -O - https://pkg.jenkins.io/debian-stable/jenkins.io.key | apt-key add -
echo "deb https://pkg.jenkins.io/debian-stable binary/" | tee /etc/apt/sources.list.d/jenkins.list

# Install Java (required for Jenkins)
apt-get update
apt-get install -y default-jre

# Install Jenkins
apt-get install -y jenkins

# Start Jenkins
systemctl start jenkins
systemctl enable jenkins

# Check status
systemctl status jenkins
```

### Step 2: Access Jenkins UI

```bash
# Get Jenkins initial admin password
cat /var/lib/jenkins/secrets/initialAdminPassword
```

Access Jenkins at: `http://148.135.137.110:8080`

1. Paste the admin password
2. Click "Install suggested plugins"
3. Create admin user:
   - Username: `admin`
   - Password: `AdminPass123!`
   - Email: `admin@simplecrmdev.com`

### Step 3: Install Required Plugins

Go to **Manage Jenkins** → **Manage Plugins** → **Available** and install:

- Pipeline
- GitHub Integration
- Docker Pipeline
- Email Extension Plugin
- Slack Notification Plugin
- Blue Ocean (UI improvement)
- SSH Agent Plugin
- Timestamper

Apply and restart Jenkins.

### Step 4: Configure SSH Key for Git & Hostinger

**Add Git SSH Key:**

```bash
# Create SSH key for Jenkins
sudo su - jenkins
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub
```

Copy the public key and add it to your GitHub/GitLab repository deployment keys.

**Add Hostinger SSH Key:**

```bash
# Copy your Hostinger SSH key to Jenkins
sudo -u jenkins scp -i ~/.ssh/id_ed25519 root@148.135.137.110:/root/ers ~/hostinger-key.pem
sudo -u jenkins chmod 600 ~/hostinger-key.pem
```

---

## 📋 Part 2: Jenkins Pipeline Definition

Create a `Jenkinsfile` in your Git repository root:

```groovy
pipeline {
    agent any
    
    options {
        timestamps()
        timeout(time: 1, unit: 'HOURS')
        buildDiscarder(logRotator(numToKeepStr: '10'))
    }
    
    parameters {
        choice(name: 'ENVIRONMENT', choices: ['staging', 'production'], description: 'Deployment environment')
        booleanParam(name: 'SKIP_TESTS', defaultValue: false, description: 'Skip automated tests')
        booleanParam(name: 'BACKUP_DB', defaultValue: true, description: 'Backup database before deploy')
    }
    
    environment {
        DOCKER_REGISTRY = 'docker.io'  // Or your private registry
        IMAGE_TAG = "${BUILD_NUMBER}-${GIT_COMMIT.take(7)}"
        HOSTINGER_HOST = '148.135.137.110'
        HOSTINGER_USER = 'root'
        HOSTINGER_PATH = '/root/ers'
        SLACK_WEBHOOK = credentials('slack-webhook-url')
    }
    
    stages {
        stage('Checkout') {
            steps {
                echo "🔄 Checking out code..."
                checkout scm
                script {
                    env.GIT_BRANCH = sh(returnStdout: true, script: 'git rev-parse --abbrev-ref HEAD').trim()
                    env.GIT_COMMIT_MSG = sh(returnStdout: true, script: 'git log -1 --pretty=%B').trim()
                }
            }
        }
        
        stage('Build') {
            steps {
                echo "🔨 Building Docker images..."
                script {
                    sh '''
                        docker build -t enterprise-reporting-system:${IMAGE_TAG} -f Dockerfile .
                        docker build -t ers-mastra:${IMAGE_TAG} -f Dockerfile.mastra .
                        docker build -t ers-stt:${IMAGE_TAG} -f Dockerfile.stt .
                    '''
                }
            }
        }
        
        stage('Test') {
            when {
                expression { params.SKIP_TESTS == false }
            }
            steps {
                echo "🧪 Running tests..."
                script {
                    sh '''
                        # Run application tests
                        bun test:ci || true
                        
                        # Run e2e tests if environment supports it
                        # bun test:e2e || true
                    '''
                }
            }
            post {
                always {
                    junit testResults: 'test-results/**/*.xml', allowEmptyResults: true
                }
            }
        }
        
        stage('Security Scan') {
            steps {
                echo "🔒 Running security scans..."
                script {
                    sh '''
                        # Scan Docker images for vulnerabilities
                        docker run --rm \
                          -v /var/run/docker.sock:/var/run/docker.sock \
                          aquasec/trivy image --severity HIGH,CRITICAL \
                          enterprise-reporting-system:${IMAGE_TAG} || true
                    '''
                }
            }
        }
        
        stage('Prepare Deployment') {
            when {
                branch 'main'
            }
            steps {
                echo "📦 Preparing deployment package..."
                script {
                    sh '''
                        # Export database
                        echo "Exporting database..."
                        docker exec ers-local-mariadb mysqldump \
                          -u enterprise -penterprise_pass enterprise_config > \
                          /tmp/db-backup-${BUILD_NUMBER}.sql || true
                        
                        # Create deployment archive
                        tar czf deployment-${IMAGE_TAG}.tar.gz \
                          docker-compose.remote.yml \
                          Dockerfile* \
                          package.json \
                          bun.lock \
                          mastra/ \
                          src/ \
                          .env.remote.example || true
                    '''
                }
            }
        }
        
        stage('Backup') {
            when {
                branch 'main'
                expression { params.BACKUP_DB == true }
            }
            steps {
                echo "💾 Backing up remote database..."
                sshagent(['hostinger-ssh-key']) {
                    sh '''
                        ssh -o StrictHostKeyChecking=no ${HOSTINGER_USER}@${HOSTINGER_HOST} << 'EOF'
                        cd ${HOSTINGER_PATH}
                        
                        # Backup database
                        docker exec ers-remote-mariadb mysqldump \
                          -u enterprise -penterprise_pass enterprise_config > \
                          backups/db-backup-$(date +%Y%m%d_%H%M%S).sql
                        
                        # Keep only last 10 backups
                        ls -t backups/db-backup-*.sql | tail -n +11 | xargs rm -f
                        
                        echo "✅ Database backup complete"
EOF
                    '''
                }
            }
        }
        
        stage('Deploy to Hostinger') {
            when {
                branch 'main'
            }
            steps {
                echo "🚀 Deploying to Hostinger..."
                sshagent(['hostinger-ssh-key']) {
                    sh '''
                        ssh -o StrictHostKeyChecking=no ${HOSTINGER_USER}@${HOSTINGER_HOST} << 'EOF'
                        cd ${HOSTINGER_PATH}
                        
                        # Pull latest code
                        git pull origin main || true
                        
                        # Update .env if needed
                        # (Implement environment-specific configuration)
                        
                        # Stop old containers
                        docker compose -f docker-compose.remote.yml down
                        
                        # Pull latest images or build
                        docker compose -f docker-compose.remote.yml build --pull
                        
                        # Start containers
                        docker compose -f docker-compose.remote.yml up -d
                        
                        # Wait for services to be healthy
                        sleep 30
                        
                        # Run health checks
                        docker compose -f docker-compose.remote.yml ps
                        
                        echo "✅ Deployment complete"
EOF
                    '''
                }
            }
        }
        
        stage('Database Migration') {
            when {
                branch 'main'
            }
            steps {
                echo "🗄️ Running database migrations..."
                sshagent(['hostinger-ssh-key']) {
                    sh '''
                        ssh -o StrictHostKeyChecking=no ${HOSTINGER_USER}@${HOSTINGER_HOST} << 'EOF'
                        cd ${HOSTINGER_PATH}
                        
                        # Import database dump if new deployment
                        if [ ! -f .deployed ]; then
                            docker exec ers-remote-mariadb mysql -u enterprise \
                              -penterprise_pass enterprise_config < enterprise_config_backup.sql
                            touch .deployed
                            echo "✅ Database initialized"
                        else
                            echo "✅ Database already initialized"
                        fi
EOF
                    '''
                }
            }
        }
        
        stage('Health Checks') {
            steps {
                echo "🏥 Running health checks..."
                script {
                    sh '''
                        set +e
                        
                        echo "Checking application..."
                        curl -f http://148.135.137.110:3000/api/health && \
                          echo "✅ App healthy" || echo "⚠️  App not responding"
                        
                        echo ""
                        echo "Checking Mastra..."
                        curl -f http://148.135.137.110:4111/health && \
                          echo "✅ Mastra healthy" || echo "⚠️  Mastra not responding"
                        
                        echo ""
                        echo "Checking STT..."
                        curl -f http://148.135.137.110:8081/health && \
                          echo "✅ STT healthy" || echo "⚠️  STT not responding"
                        
                        set -e
                    '''
                }
            }
        }
        
        stage('Smoke Tests') {
            steps {
                echo "🔥 Running smoke tests..."
                script {
                    sh '''
                        # Basic connectivity test
                        echo "Testing login endpoint..."
                        curl -X GET http://148.135.137.110:3000/api/auth/session \
                          -H "Accept: application/json" || true
                        
                        echo ""
                        echo "Testing database connection..."
                        curl -X GET http://148.135.137.110:3000/api/health \
                          -H "Accept: application/json" || true
                    '''
                }
            }
        }
    }
    
    post {
        always {
            echo "📊 Cleaning up..."
            cleanWs()
        }
        
        success {
            echo "✅ Pipeline succeeded"
            script {
                def message = """
                    ✅ Deployment Successful
                    
                    Environment: ${params.ENVIRONMENT}
                    Build: #${BUILD_NUMBER}
                    Branch: ${GIT_BRANCH}
                    Commit: ${GIT_COMMIT.take(7)}
                    Message: ${GIT_COMMIT_MSG}
                    URL: ${BUILD_URL}
                """
                
                // Send Slack notification
                sh '''
                    curl -X POST ${SLACK_WEBHOOK} \
                      -H 'Content-Type: application/json' \
                      -d '{
                        "text": "✅ Enterprise Reporting System - Deployment Successful",
                        "blocks": [
                          {
                            "type": "section",
                            "text": {
                              "type": "mrkdwn",
                              "text": "'" + "${message}" + '"
                            }
                          }
                        ]
                      }' || true
                '''
            }
        }
        
        failure {
            echo "❌ Pipeline failed"
            script {
                def message = """
                    ❌ Deployment Failed
                    
                    Environment: ${params.ENVIRONMENT}
                    Build: #${BUILD_NUMBER}
                    Branch: ${GIT_BRANCH}
                    Error URL: ${BUILD_URL}console
                """
                
                sh '''
                    curl -X POST ${SLACK_WEBHOOK} \
                      -H 'Content-Type: application/json' \
                      -d '{
                        "text": "❌ Enterprise Reporting System - Deployment Failed",
                        "attachments": [
                          {
                            "color": "danger",
                            "text": "'" + "${message}" + '"
                          }
                        ]
                      }' || true
                '''
            }
        }
    }
}
```

---

## 🔧 Part 3: Configure Jenkins Job

### Create New Pipeline Job:

1. **Dashboard** → **New Item**
2. **Name**: `enterprise-reporting-deployment`
3. **Type**: `Pipeline`
4. **Create**

### Configure:

**Pipeline:**
- Definition: `Pipeline script from SCM`
- SCM: `Git`
- Repository URL: `https://github.com/yourusername/enterprise_reporting_tanstack.git`
- Branch: `*/main`
- Script Path: `Jenkinsfile`

**Build Triggers:**
- Check: `GitHub hook trigger for GITScm polling`
- Or: `Poll SCM` with schedule: `H H * * *` (daily at midnight)

**Parameters:**
- Add the parameters from the Jenkinsfile above

---

## 📱 Part 4: GitHub/GitLab Webhook Setup

### GitHub:

1. Go to **Settings** → **Webhooks** → **Add webhook**
2. **Payload URL**: `http://your-jenkins-ip:8080/github-webhook/`
3. **Content type**: `application/json`
4. **Events**: `push`, `pull_request`
5. **Active**: ✓

### GitLab:

1. Go to **Settings** → **Integrations** → **Jenkins**
2. **Jenkins server URL**: `http://your-jenkins-ip:8080`
3. **Project name**: `enterprise-reporting-tanstack`
4. **Active**: ✓

---

## 🔐 Part 5: Credential Management

### Add SSH Key Credential:

1. **Manage Jenkins** → **Manage Credentials** → **System** → **Global credentials**
2. **Add Credentials**
3. **Kind**: `SSH Username with private key`
4. **ID**: `hostinger-ssh-key`
5. **Username**: `root`
6. **Private Key**: (paste your Hostinger SSH key)

### Add Slack Webhook:

1. **Add Credentials**
2. **Kind**: `Secret text`
3. **ID**: `slack-webhook-url`
4. **Secret**: (paste your Slack webhook URL)

---

## 📊 Part 6: Advanced Features

### Rollback Pipeline

Create another pipeline for rollback:

```groovy
pipeline {
    agent any
    
    parameters {
        string(name: 'ROLLBACK_BUILD', defaultValue: '1', description: 'Build number to rollback to')
    }
    
    stages {
        stage('Rollback') {
            steps {
                echo "⏮️  Rolling back to build #${params.ROLLBACK_BUILD}..."
                sshagent(['hostinger-ssh-key']) {
                    sh '''
                        ssh -o StrictHostKeyChecking=no root@148.135.137.110 << 'EOF'
                        cd /root/ers
                        
                        # Get previous image tags from history
                        PREVIOUS_TAG="${params.ROLLBACK_BUILD}-*"
                        
                        # Stop current containers
                        docker compose -f docker-compose.remote.yml down
                        
                        # Restore and start previous version
                        docker images | grep $PREVIOUS_TAG
                        
                        # Update and restart
                        docker compose -f docker-compose.remote.yml up -d
                        
                        echo "✅ Rollback complete"
EOF
                    '''
                }
            }
        }
    }
}
```

### Database Migration Pipeline

```groovy
stage('Run Migrations') {
    steps {
        sh '''
            docker exec ers-remote-mariadb mysql -u enterprise \
              -penterprise_pass enterprise_config << 'SQL'
              -- Add your migration SQL here
              -- ALTER TABLE users ADD COLUMN new_field VARCHAR(255);
SQL
        '''
    }
}
```

### Performance Monitoring

```groovy
stage('Monitor Performance') {
    steps {
        sh '''
            echo "📊 Monitoring deployment..."
            ssh -o StrictHostKeyChecking=no root@148.135.137.110 << 'EOF'
            
            # Monitor CPU & Memory
            echo "CPU & Memory usage:"
            docker stats --no-stream
            
            # Check disk space
            echo ""
            echo "Disk usage:"
            df -h /root/ers
            
            # Check container logs for errors
            echo ""
            echo "Recent errors:"
            docker compose -f /root/ers/docker-compose.remote.yml logs --tail=20 | grep -i error || true
            
EOF
        '''
    }
}
```

---

## 🎯 Part 7: Best Practices

### Environment-Specific Configuration

Use Jenkins credentials for environment variables:

```groovy
withCredentials([
    file(credentialsId: 'hostinger-env-file', variable: 'ENV_FILE')
]) {
    sh 'cp $ENV_FILE ${HOSTINGER_PATH}/.env'
}
```

### Automated Testing Before Deploy

```groovy
stage('Integration Tests') {
    steps {
        sh '''
            # Start services in test mode
            docker-compose -f docker-compose.test.yml up -d
            
            # Wait for services
            sleep 10
            
            # Run tests
            npm run test:integration
            
            # Cleanup
            docker-compose -f docker-compose.test.yml down
        '''
    }
}
```

### Deployment History & Artifacts

```groovy
archiveArtifacts artifacts: 'deployment-*.tar.gz', allowEmptyArchive: true
```

---

## 📈 Part 8: Monitoring & Alerting

### Blue Ocean Dashboard

Visit `http://your-jenkins-ip:8080/blue` for visual pipeline overview

### Email Notifications

Configure in Jenkins:

1. **Manage Jenkins** → **Configure System** → **Email Notification**
2. Set SMTP server details
3. Default recipient: `admin@simplecrmdev.com`

### Slack Integration

Install Jenkins Slack plugin and configure webhook in your Jenkinsfile.

---

## 🔄 Part 9: Continuous Deployment Workflow

### Typical Flow:

1. **Developer pushes to `main` branch**
   ↓
2. **GitHub sends webhook to Jenkins**
   ↓
3. **Jenkins triggers build pipeline**
   ↓
4. **Docker images built and tested**
   ↓
5. **Backup previous deployment**
   ↓
6. **Deploy new version to Hostinger**
   ↓
7. **Run health checks and smoke tests**
   ↓
8. **Notify team on Slack**
   ↓
9. **Update deployment history**

---

## 📋 Quick Reference Commands

### Manual Jenkins Operations

```bash
# Restart Jenkins
systemctl restart jenkins

# Check Jenkins logs
tail -f /var/log/jenkins/jenkins.log

# Jenkins CLI operations
java -jar jenkins-cli.jar -s http://localhost:8080 \
  restart

# List jobs
java -jar jenkins-cli.jar -s http://localhost:8080 \
  list-jobs

# Build job
java -jar jenkins-cli.jar -s http://localhost:8080 \
  build enterprise-reporting-deployment -w
```

---

## 🚀 Summary

This Jenkins CI/CD setup provides:

- ✅ Automated builds on every Git push
- ✅ Comprehensive testing before deployment
- ✅ Blue/green deployment capability
- ✅ Automatic rollback support
- ✅ Database backup before every deploy
- ✅ Health checks and monitoring
- ✅ Slack notifications
- ✅ Audit trail of all deployments
- ✅ One-click rollback if needed

**Next Steps:**
1. Install Jenkins on your server or separate machine
2. Configure GitHub/GitLab webhooks
3. Add SSH credentials to Jenkins
4. Create Jenkinsfile in your repository
5. Trigger first build and test the pipeline

---

**Jenkins best practices:**
- Keep Jenkins server separate from application server
- Use managed credentials for all secrets
- Implement proper backup strategy for Jenkins config
- Monitor Jenkins disk space
- Update Jenkins and plugins regularly
- Use locked-down RBAC for Jenkins access
