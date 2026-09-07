#!/bin/bash
# ==========================================
# VPS Diagnostic & Recovery Script
# Run this from the Hostinger Console
# ==========================================

echo "🔍 VPS Diagnostic Tool"
echo "====================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Please run as root (use sudo)"
    exit 1
fi

echo "1️⃣ System Status"
echo "-----------------"
echo "Hostname: $(hostname)"
echo "Uptime: $(uptime)"
echo "Memory: $(free -h | grep Mem | awk '{print $3 "/" $2}')"
echo "Disk: $(df -h / | tail -1 | awk '{print $3 "/" $2 " (" $5 ")"}')"
echo ""

echo "2️⃣ Network Status"
echo "-----------------"
echo "Network interfaces:"
ip addr show | grep -E "inet|ether" | head -10
echo ""
echo "Default gateway:"
ip route | grep default
echo ""
echo "DNS servers:"
cat /etc/resolv.conf
echo ""

echo "3️⃣ Service Status"
echo "-----------------"
systemctl status ssh --no-pager -l | head -15
echo ""
systemctl status docker --no-pager -l | head -15
echo ""

echo "4️⃣ Firewall Status"
echo "-------------------"
ufw status 2>/dev/null || echo "ufw not installed"
echo ""
iptables -L -n | head -20
echo ""

echo "5️⃣ Docker Status"
echo "-----------------"
docker ps -a
echo ""

echo "6️⃣ Listening Ports"
echo "------------------"
ss -tlnp | grep -E "(22|3000|5432|6379)" || netstat -tlnp | grep -E "(22|3000|5432|6379)"
echo ""

echo "7️⃣ Recent Logs"
echo "--------------"
echo "SSH auth log:"
tail -20 /var/log/auth.log 2>/dev/null || tail -20 /var/log/secure 2>/dev/null
echo ""
echo "Docker logs (if any):"
if [ -f /srv/enterprise-reporting-system/docker-compose.yml ]; then
    cd /srv/enterprise-reporting-system
    docker compose logs --tail=50 2>/dev/null || echo "No docker compose logs available"
fi
echo ""

echo "✅ Diagnostic complete!"
echo ""
echo "🔧 Common fixes:"
echo ""
echo "If SSH is not running:"
echo "  systemctl restart ssh"
echo ""
echo "If network is down:"
echo "  systemctl restart networking"
echo "  # or"
echo "  ip link set eth0 down && ip link set eth0 up"
echo ""
echo "If firewall is blocking:"
echo "  ufw allow 22/tcp"
echo "  ufw allow 3000/tcp"
echo "  ufw allow 5432/tcp"
echo "  ufw allow 6379/tcp"
echo "  ufw enable"
echo ""
