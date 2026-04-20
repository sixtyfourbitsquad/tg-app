#!/usr/bin/env bash
# Run on PC after downloading videos with scripts/download-tg-channel.py
# Usage: bash scripts/deploy-videos.sh
#
# What it does:
#   1. rsync every file from LOCAL_PATH into VPS_PATH (resumable, skips files
#      already present with the same size+mtime, much faster than scp -r).
#   2. ssh into the VPS and run the bulk-upload script so each new video lands
#      in Postgres with the right url / file_path / file_size / title.

set -euo pipefail

# ───────────────────────────── Config ──────────────────────────────
VPS_USER="adii"
VPS_IP="35.200.162.160"
VPS_PATH="/home/adii/videos/"
LOCAL_PATH="./downloaded_videos/"
# Default to the standard OpenSSH key the user already authorised on the VPS.
# Override with e.g. `SSH_KEY=./key.txt bash scripts/deploy-videos.sh` if you
# keep a dedicated deploy key in the repo.
SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_ed25519}"
APP_DIR="~/tg-app"        # repo root on the VPS (expanded remotely)
SSH_PORT="22"
# ───────────────────────────────────────────────────────────────────

# Resolve script dir so relative paths work no matter where the script is run from.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

die() { printf 'error: %s\n' "$*" >&2; exit 1; }

[[ -r "$SSH_KEY" ]] || die "SSH key not found or not readable: $SSH_KEY"
[[ -d "$LOCAL_PATH" ]] || die "Local videos folder not found: $LOCAL_PATH"

# Warn loudly if the key is world/group readable — ssh will refuse to use it.
key_perms="$(stat -c '%a' "$SSH_KEY" 2>/dev/null || stat -f '%A' "$SSH_KEY" 2>/dev/null || echo "")"
if [[ -n "$key_perms" && "$key_perms" != "600" && "$key_perms" != "400" ]]; then
  echo "warning: $SSH_KEY has permissions $key_perms — tightening to 600"
  chmod 600 "$SSH_KEY"
fi

file_count="$(find "$LOCAL_PATH" -maxdepth 1 -type f -name '*.mp4' 2>/dev/null | wc -l | tr -d ' ')"
if [[ "$file_count" == "0" ]]; then
  die "no .mp4 files found in $LOCAL_PATH — run scripts/download-tg-channel.py first"
fi

SSH_OPTS=(-i "$SSH_KEY" -p "$SSH_PORT" -o StrictHostKeyChecking=accept-new -o ServerAliveInterval=30)

echo "──────────────────────────────────────────────────────────────"
echo "Deploying $file_count file(s) from $LOCAL_PATH"
echo "  → $VPS_USER@$VPS_IP:$VPS_PATH"
echo "──────────────────────────────────────────────────────────────"

# Make sure the remote folder exists.
ssh "${SSH_OPTS[@]}" "$VPS_USER@$VPS_IP" "mkdir -p '$VPS_PATH'"

echo
echo "[1/2] Uploading videos (rsync, resumable, skips already-synced files)…"
if command -v rsync >/dev/null 2>&1; then
  rsync -avh --partial --progress \
    -e "ssh ${SSH_OPTS[*]}" \
    --include='*.mp4' --include='*/' --exclude='*' \
    "$LOCAL_PATH" "$VPS_USER@$VPS_IP:$VPS_PATH"
else
  echo "rsync not found, falling back to scp (no resume, no skip)…"
  scp "${SSH_OPTS[@]}" -r "$LOCAL_PATH"*.mp4 "$VPS_USER@$VPS_IP:$VPS_PATH"
fi

echo
echo "[2/2] Registering videos in the database on the VPS…"
# The app runs entirely in Docker, so we exec the bundled bulk-upload script
# inside the app container. /app/videos-data is where the host's video dir is
# bind-mounted (see docker-compose.yml), so the script sees the files we just
# rsynced and inserts a row per new .mp4.
ssh "${SSH_OPTS[@]}" "$VPS_USER@$VPS_IP" bash -lc "'
  set -euo pipefail
  cd $APP_DIR
  docker compose exec -T app node scripts/bulk-upload.cjs /app/videos-data
'"

echo
echo "Done."
