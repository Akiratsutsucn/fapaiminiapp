#!/bin/bash
# ================================================================
# 法拍者联盟 — Production Deployment Script
# Target server: 122.51.156.252
# ================================================================
set -e

PROJECT_DIR="/opt/fapai"
BACKEND_DIR="$PROJECT_DIR/backend"
CRAWLER_DIR="$PROJECT_DIR/crawler"
ADMIN_DIR="$PROJECT_DIR/admin-web"
VENV_DIR="$PROJECT_DIR/venv"
LOG_DIR="/var/log/fapai"

echo "=== 法拍者联盟 部署脚本 ==="
echo "Target: $(hostname)"

# ---- 1. Create directories ----
mkdir -p "$PROJECT_DIR" "$LOG_DIR"

# ---- 2. Install system dependencies ----
echo "[1/6] Installing system dependencies..."
apt-get update -qq
apt-get install -y -qq python3.13 python3.13-venv python3-pip nginx certbot python3-certbot-nginx \
    chromium-browser nodejs npm > /dev/null 2>&1

# ---- 3. Python venv ----
echo "[2/6] Setting up Python virtual environment..."
python3.13 -m venv "$VENV_DIR"
source "$VENV_DIR/bin/activate"
pip install -r "$BACKEND_DIR/requirements.txt" -r "$CRAWLER_DIR/requirements.txt"
playwright install chromium
deactivate

# ---- 4. Database setup (MySQL) ----
echo "[3/6] Configuring database..."
# Assumes MySQL is already installed and running
# Create database and user if not exists:
# mysql -u root -p <<SQL
# CREATE DATABASE IF NOT EXISTS shanghai_fapai CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
# CREATE USER IF NOT EXISTS 'fapai'@'localhost' IDENTIFIED BY 'fapai123';
# GRANT ALL PRIVILEGES ON shanghai_fapai.* TO 'fapai'@'localhost';
# FLUSH PRIVILEGES;
# SQL

# ---- 5. Seed demo data ----
echo "[4/6] Seeding demo data..."
source "$VENV_DIR/bin/activate"
cd "$PROJECT_DIR"
python seed_demo_data.py

# ---- 6. Systemd services ----
echo "[5/6] Installing systemd services..."
cp "$PROJECT_DIR/deploy/fapai-backend.service" /etc/systemd/system/
cp "$PROJECT_DIR/deploy/fapai-crawler.service" /etc/systemd/system/
cp "$PROJECT_DIR/deploy/fapai-crawler.timer" /etc/systemd/system/
systemctl daemon-reload
systemctl enable fapai-backend
systemctl enable fapai-crawler.timer
systemctl start fapai-backend
systemctl start fapai-crawler.timer

# ---- 7. Nginx ----
echo "[6/6] Configuring Nginx..."
cp "$PROJECT_DIR/deploy/nginx.conf" /etc/nginx/sites-available/fapai
ln -sf /etc/nginx/sites-available/fapai /etc/nginx/sites-enabled/
# Build admin panel
cd "$ADMIN_DIR"
npm install
npm run build
cp -r dist/* /var/www/html/admin/
# 注意：nginx.conf 的两个 443 server 块引用 letsencrypt 证书，
# 首次部署前须先签发证书（见下方 Next steps 第 1 步），否则 nginx -t 会因找不到证书失败。
# certbot 续期 HTTP-01 验证目录：
mkdir -p /var/www/certbot
nginx -t && systemctl reload nginx

# ---- Done ----
echo ""
echo "=============================================="
echo "  Deployment Complete!"
echo "  API:     https://xcxapi.fapaizhelianmeng.cn"
echo "  Admin:   https://admin.fapaizhelianmeng.cn"
echo "=============================================="
echo ""
echo "Next steps:"
echo "  1. Configure SSL (首次/证书过期时):"
echo "       certbot certonly --webroot -w /var/www/certbot \\"
echo "         -d xcxapi.fapaizhelianmeng.cn -d admin.fapaizhelianmeng.cn"
echo "     证书签发后再执行 nginx -t && systemctl reload nginx"
echo "  2. Update .env with production SECRET_KEY"
echo "  3. Verify /picture mount: df -h /picture"
echo "  4. Test HTTPS + 80 跳转:"
echo "       curl -I http://xcxapi.fapaizhelianmeng.cn/   # 期望 301 -> https"
echo "       curl https://xcxapi.fapaizhelianmeng.cn/health"
