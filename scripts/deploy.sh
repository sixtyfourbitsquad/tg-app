#!/usr/bin/env bash
# deploy.sh — Full Ubuntu 22.04 GCP VM deployment
# Usage: sudo bash scripts/deploy.sh
set -euo pipefail

DOMAIN="${DOMAIN:-example.com}"
REPO_URL="${REPO_URL:-https://github.com/sixtyfourbitsquad/tg-app.git}"
APP_DIR="/var/www/nfws"
COMPOSE_VERSION="2.24.0"

log() { echo -e "\033[1;32m[DEPLOY]\033[0m $*"; }
err() { echo -e "\033[1;31m[ERROR]\033[0m $*" >&2; exit 1; }

# ── 1. System update ──────────────────────────────────────────────────────
log "Updating system packages..."
apt-get update -qq
apt-get upgrade -y -qq

# ── 2. Install Docker ─────────────────────────────────────────────────────
log "Installing Docker..."
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
  usermod -aG docker "$SUDO_USER" || true
else
  log "Docker already installed — skipping"
fi

# ── 3. Install Docker Compose v2 ─────────────────────────────────────────
log "Installing Docker Compose..."
if ! docker compose version &>/dev/null; then
  mkdir -p /usr/local/lib/docker/cli-plugins
  curl -SL "https://github.com/docker/compose/releases/download/v${COMPOSE_VERSION}/docker-compose-linux-x86_64" \
    -o /usr/local/lib/docker/cli-plugins/docker-compose
  chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
else
  log "Docker Compose already installed — skipping"
fi

# ── 4. Install Nginx + Certbot ────────────────────────────────────────────
log "Installing Nginx and Certbot..."
apt-get install -y nginx certbot python3-certbot-nginx

# ── 5. Install Node.js 20 (for PM2 / manual pipeline runs) ───────────────
log "Installing Node.js 20..."
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

# ── 6. Install PM2 globally ───────────────────────────────────────────────
log "Installing PM2..."
npm install -g pm2 tsx ts-node 2>/dev/null || true

# ── 7. Clone / update repo ────────────────────────────────────────────────
log "Setting up application..."
if [ -d "$APP_DIR/.git" ]; then
  log "Repo exists — pulling latest..."
  git -C "$APP_DIR" pull --ff-only
else
  git clone "$REPO_URL" "$APP_DIR"
fi

# ── 8. Setup .env ─────────────────────────────────────────────────────────
if [ ! -f "$APP_DIR/.env" ]; then
  log "Creating .env from .env.example — EDIT THIS FILE before continuing!"
  cp "$APP_DIR/.env.example" "$APP_DIR/.env"
  err ".env file created at $APP_DIR/.env — fill in all values and re-run this script"
fi

# ── 9. Secrets directory ──────────────────────────────────────────────────
mkdir -p "$APP_DIR/secrets"
chown -R 1001:1001 "$APP_DIR/secrets" 2>/dev/null || true

# ── 10. Build + start Docker Compose ─────────────────────────────────────
log "Building and starting containers..."
cd "$APP_DIR"
docker compose pull --quiet
docker compose build --no-cache
docker compose up -d

# ── 11. Wait for DB to be ready ───────────────────────────────────────────
log "Waiting for PostgreSQL..."
until docker compose exec -T postgres pg_isready -U postgres -d nfws_db &>/dev/null; do
  sleep 2
done

# ── 12. Run Prisma migrations ─────────────────────────────────────────────
log "Running database migrations..."
docker compose exec -T app npx prisma migrate deploy

# ── 13. Setup Nginx ───────────────────────────────────────────────────────
log "Configuring Nginx..."
# Replace YOUR_DOMAIN placeholder with real domain
sed "s/YOUR_DOMAIN/$DOMAIN/g" "$APP_DIR/nginx.conf" \
  > /etc/nginx/sites-available/nfws

ln -sf /etc/nginx/sites-available/nfws /etc/nginx/sites-enabled/nfws
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl reload nginx

# ── 14. SSL certificate ───────────────────────────────────────────────────
log "Obtaining SSL certificate for $DOMAIN..."
# Create webroot for ACME challenge
mkdir -p /var/www/certbot
certbot certonly --webroot -w /var/www/certbot -d "$DOMAIN" \
  --non-interactive --agree-tos --email "admin@$DOMAIN" || \
  log "Warning: Certbot failed — configure manually if needed"

# Reload nginx with SSL config
nginx -t && systemctl reload nginx

# ── 15. Auto-renew cron ───────────────────────────────────────────────────
(crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet && systemctl reload nginx") | \
  sort -u | crontab -

# ── 16. PM2 pipeline scheduler ───────────────────────────────────────────
log "Starting pipeline scheduler with PM2..."
cd "$APP_DIR"
pm2 delete nfws-pipeline 2>/dev/null || true
pm2 start tsx --name nfws-pipeline -- pipeline/scheduler.ts
pm2 save
pm2 startup | tail -1 | bash || true

# ── 17. Verify ────────────────────────────────────────────────────────────
log "Verifying services..."
sleep 5

docker compose ps
echo ""
curl -sf "http://localhost:3000/api/health" | python3 -m json.tool || \
  log "Warning: health check failed — check container logs"

echo ""
log "✓ Deployment complete!"
log "  App URL:     https://$DOMAIN"
log "  Health:      https://$DOMAIN/api/health"
log "  Logs:        docker compose logs -f app"
log "  Pipeline:    pm2 logs nfws-pipeline"
log "  Manual run:  cd $APP_DIR && npm run pipeline:run"
