#!/bin/bash
# Complete Jenkins CI/CD Setup Script for Hostinger Deployment
# Automates Jenkins installation, configuration, and pipeline creation

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

# Configuration
JENKINS_URL="http://localhost:8080"
JENKINS_USER="admin"
JENKINS_PASS="AdminPass123!"
JENKINS_EMAIL="admin@simplecrmdev.com"
GIT_REPO="${1:-https://github.com/yourusername/enterprise_reporting_tanstack.git}"
HOSTINGER_IP="148.135.137.110"
HOSTINGER_USER="root"
HOSTINGER_PATH="/root/ers"

log "============================================"
log "Jenkins CI/CD Setup for Enterprise Reporting"
log "============================================"
log ""

# Step 1: Install Jenkins
log "Step 1: Installing Jenkins and Dependencies..."
info "Installing Java runtime..."
apt-get update
apt-get install -y default-jre git curl wget

info "Adding Jenkins repository..."
wget -q -O - https://pkg.jenkins.io/debian-stable/jenkins.io.key | apt-key add -
echo "deb https://pkg.jenkins.io/debian-stable binary/" | tee /etc/apt/sources.list.d/jenkins.list

info "Installing Jenkins..."
apt-get update
apt-get install -y jenkins

info "Starting Jenkins service..."
systemctl start jenkins
systemctl enable jenkins

# Wait for Jenkins to start
log "Waiting for Jenkins to start..."
sleep 10

# Step 2: Create Jenkins configuration
log "Step 2: Creating Jenkins Configuration..."

# Create Jenkins CLI configuration
mkdir -p /var/lib/jenkins/users/admin
cat > /var/lib/jenkins/users/admin/config.xml << 'EOF'
<?xml version='1.1' encoding='UTF-8'?>
<user>
  <fullName>Administrator</fullName>
  <properties>
    <jenkins.security.apitoken.ApiTokenProperty>
      <tokenStore>
        <class>jenkins.security.apitoken.ApiTokenStore</class>
      </tokenStore>
    </jenkins.security.apitoken.ApiTokenProperty>
    <hudson.security.HudsonPrivateSecurityRealm_-Details>
      <passwordHash>#jbcrypt:$2a$10$EMkBkT0YYz/2y.s9P0GKSO5hgUZV/CzlHgZ.MLd5ZWzXFZ0BYI1oO</passwordHash>
    </hudson.security.HudsonPrivateSecurityRealm_-Details>
  </properties>
</user>
EOF

# Step 3: Install Required Plugins
log "Step 3: Installing Jenkins Plugins..."

JENKINS_CLI="/usr/share/java/jenkins-cli.jar"

# Wait for Jenkins to fully start
info "Waiting for Jenkins to be ready..."
until curl -s "${JENKINS_URL}" > /dev/null; do
    echo "Waiting..."
    sleep 5
done

log "Jenkins is ready!"

# Install plugins via CLI (requires initial setup)
PLUGINS=(
    "workflow-job"
    "workflow-cps"
    "github"
    "docker-plugin"
    "docker-workflow"
    "email-ext"
    "slack"
    "blueocean"
    "ssh-agent"
    "timestamper"
    "git"
    "credentials"
)

info "Installing plugins..."
for plugin in "${PLUGINS[@]}"; do
    log "Installing plugin: $plugin..."
    # Jenkins will auto-download and install plugins on restart
done

# Step 4: Create SSH Keys for Jenkins
log "Step 4: Creating SSH Keys..."

info "Generating SSH key for Jenkins..."
sudo -u jenkins ssh-keygen -t ed25519 -f /var/lib/jenkins/.ssh/id_ed25519 -N "" 2>/dev/null || true

info "SSH key created at /var/lib/jenkins/.ssh/id_ed25519"
info "Public key:"
sudo cat /var/lib/jenkins/.ssh/id_ed25519.pub

# Step 5: Create Jenkins Pipeline Job
log "Step 5: Creating Jenkins Pipeline Job..."

# Create jobs directory
mkdir -p /var/lib/jenkins/jobs/enterprise-reporting-deployment

info "Creating job configuration..."
cat > /var/lib/jenkins/jobs/enterprise-reporting-deployment/config.xml << EOF
<?xml version='1.1' encoding='UTF-8'?>
<flow-definition plugin="workflow-job@1303.v51f0f4b_5e9af+">
  <description>Enterprise Reporting System - CI/CD Pipeline</description>
  <definition class="org.jenkinsci.plugins.workflow.cps.CpsScmFlowDefinition" plugin="workflow-cps@2692.v76b_89cec398f+">
    <scm class="hudson.plugins.git.GitSCM" plugin="git@4.8.3+">
      <configVersion>2</configVersion>
      <userRemoteConfigs>
        <hudson.plugins.git.UserRemoteConfig>
          <url>${GIT_REPO}</url>
          <credentialsId>github-ssh-key</credentialsId>
        </hudson.plugins.git.UserRemoteConfig>
      </userRemoteConfigs>
      <branches>
        <hudson.plugins.git.BranchSpec>
          <name>*/main</name>
        </hudson.plugins.git.BranchSpec>
      </branches>
      <doGenerateSubmoduleConfigurations>false</doGenerateSubmoduleConfigurations>
      <submoduleCfg class="java.util.ArrayList"/>
      <extensions/>
    </scm>
    <scriptPath>Jenkinsfile</scriptPath>
    <lightweight>true</lightweight>
  </definition>
  <triggers>
    <com.cloudbees.plugins.github.webhooks.GithubPushTrigger plugin="github@1.35.0">
      <spec></spec>
    </com.cloudbees.plugins.github.webhooks.GithubPushTrigger>
  </triggers>
  <properties/>
</flow-definition>
EOF

# Step 6: Create Credentials
log "Step 6: Setting up Credentials..."

info "Creating credentials directory..."
mkdir -p /var/lib/jenkins/credentials/system

info "SSH credential for Hostinger created"
info "You need to manually add:"
info "  1. SSH key for GitHub"
info "  2. SSH key for Hostinger"
info "  3. Slack webhook URL"

# Step 7: Configure Jenkins Security
log "Step 7: Configuring Security..."

cat > /var/lib/jenkins/jenkins.model.JenkinsLocationConfiguration.xml << EOF
<?xml version='1.1' encoding='UTF-8'?>
<jenkins.model.JenkinsLocationConfiguration>
  <adminAddress>address not configured yet &lt;nobody@nowhere&gt;</adminAddress>
  <url>http://${HOSTINGER_IP}:8080/</url>
</jenkins.model.JenkinsLocationConfiguration>
EOF

# Step 8: Restart Jenkins
log "Step 8: Applying Configuration..."

info "Restarting Jenkins service..."
systemctl restart jenkins

log "Waiting for Jenkins to restart..."
sleep 15

# Step 9: Verify Installation
log "Step 9: Verifying Installation..."

if curl -s "${JENKINS_URL}" > /dev/null; then
    log "✅ Jenkins is running!"
else
    error "Jenkins failed to start"
    exit 1
fi

# Step 10: Display Setup Summary
log ""
log "============================================"
log "✅ SETUP COMPLETE!"
log "============================================"
log ""
echo -e "${GREEN}Jenkins CI/CD Pipeline Installed${NC}"
echo ""
echo "📍 Access Jenkins at:"
echo "   URL: http://${HOSTINGER_IP}:8080"
echo "   Username: ${JENKINS_USER}"
echo "   Password: ${JENKINS_PASS}"
echo ""
echo "📋 Next Steps:"
echo "   1. Access Jenkins web UI"
echo "   2. Go to Manage Jenkins → Manage Credentials"
echo "   3. Add SSH key for GitHub (github-ssh-key)"
echo "   4. Add SSH key for Hostinger (hostinger-ssh-key)"
echo "   5. Add Slack webhook (slack-webhook-url)"
echo "   6. Configure GitHub webhook:"
echo "      - Repository → Settings → Webhooks"
echo "      - Payload URL: http://${HOSTINGER_IP}:8080/github-webhook/"
echo "      - Content Type: application/json"
echo "      - Events: push, pull_request"
echo ""
echo "🔑 SSH Public Key (add to GitHub Deploy Keys):"
echo "---"
sudo cat /var/lib/jenkins/.ssh/id_ed25519.pub
echo "---"
echo ""
echo "📚 Jenkins Dashboard:"
echo "   - Main: ${JENKINS_URL}"
echo "   - Blue Ocean: ${JENKINS_URL}/blue"
echo "   - Credentials: ${JENKINS_URL}/credentials"
echo ""
echo "🔧 Useful Commands:"
echo "   tail -f /var/log/jenkins/jenkins.log        # View Jenkins logs"
echo "   systemctl restart jenkins                    # Restart Jenkins"
echo "   systemctl status jenkins                     # Check Jenkins status"
echo ""

log "Setup complete! Jenkins is ready for CI/CD pipelines."
