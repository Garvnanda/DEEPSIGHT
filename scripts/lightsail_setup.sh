#!/usr/bin/env bash
# Deep-Sight backend on a single Ubuntu server (AWS Lightsail). Run as the default user:
#   bash lightsail_setup.sh            # HTTPS host defaults to <public-ip>.sslip.io
#   bash lightsail_setup.sh my.host    # or pass your own hostname
# Safe to re-run: it pulls the latest main, rebuilds the image and restarts the containers.
# Survey data (demo tiles, uploads, saved surveys) lives in ~/deepsight-data, outside git.
set -euo pipefail

REPO=https://github.com/Garvnanda/DEEPSIGHT.git
APP_DIR="$HOME/deepsight"
DATA_DIR="$HOME/deepsight-data"

# 4 GB swap: the $7 plan has 1 GB RAM; app peaks ~460 MB plus OS/Docker, and pip installing
# torch or parsing large XTF files spills over. Swap keeps it alive (slower) instead of OOM-killed.
if [ ! -f /swapfile ]; then
  sudo fallocate -l 4G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi

if ! command -v docker >/dev/null; then
  sudo apt-get update
  sudo apt-get install -y docker.io git
  sudo systemctl enable --now docker
fi

if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" pull --ff-only
else
  git clone --depth 1 "$REPO" "$APP_DIR"
fi

sudo docker build -t deepsight-backend "$APP_DIR"
mkdir -p "$DATA_DIR"

# Backend only on localhost; Caddy is the public entry point
sudo docker rm -f backend >/dev/null 2>&1 || true
sudo docker run -d --name backend --restart unless-stopped \
  -p 127.0.0.1:8000:8080 -v "$DATA_DIR":/app/data deepsight-backend

HOST="${1:-$(curl -fsS https://checkip.amazonaws.com | tr . -).sslip.io}"
# Caddy gets a free TLS certificate for HOST and proxies HTTP + WebSocket to the backend
sudo docker rm -f caddy >/dev/null 2>&1 || true
sudo docker run -d --name caddy --restart unless-stopped --network host \
  -v caddy_data:/data caddy:2 caddy reverse-proxy --from "$HOST" --to localhost:8000

echo
echo "Backend URL: https://$HOST"
echo "Check:       https://$HOST/health  (certificate can take ~1 minute on first run)"
[ -d "$DATA_DIR/detect" ] || echo "Demo tiles missing: extract demo_tiles.tgz into $DATA_DIR (see guide)."
