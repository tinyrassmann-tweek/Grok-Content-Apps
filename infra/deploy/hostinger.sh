#!/usr/bin/env bash
# Deploy B.i.a.B collab stack to Hostinger VPS over SSH.
# Required env:
#   HOSTINGER_SSH=user@ip-or-host
# Optional:
#   HOSTINGER_PATH=/var/www/biab-collab
#   HOSTINGER_BRANCH=main
#   SKIP_BUILD=1
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SSH_TARGET="${HOSTINGER_SSH:-}"
REMOTE_PATH="${HOSTINGER_PATH:-/var/www/biab-collab}"
BRANCH="${HOSTINGER_BRANCH:-main}"
REPO_URL="${HOSTINGER_REPO:-https://github.com/tinyrassmann-tweek/Grok-Content-Apps.git}"

if [[ -z "$SSH_TARGET" ]]; then
  cat <<EOF
✗ HOSTINGER_SSH is not set.

Example:
  export HOSTINGER_SSH=root@YOUR.VPS.IP
  export HOSTINGER_PATH=/var/www/biab-collab
  pnpm deploy:hostinger

This script will:
  1) rsync/git-sync the repo to the VPS
  2) install pnpm + deps
  3) start Postgres/Redis via docker compose (if docker present)
  4) migrate DB
  5) build + restart server with systemd/pm2 fallback
EOF
  exit 1
fi

echo "→ Deploying to $SSH_TARGET:$REMOTE_PATH (branch $BRANCH)"

ssh -o StrictHostKeyChecking=accept-new "$SSH_TARGET" bash -s <<REMOTE
set -euo pipefail
REMOTE_PATH="$REMOTE_PATH"
REPO_URL="$REPO_URL"
BRANCH="$BRANCH"

sudo mkdir -p "\$REMOTE_PATH"
sudo chown -R "\$(whoami):\$(whoami)" "\$REMOTE_PATH" 2>/dev/null || true
cd "\$REMOTE_PATH"

if [[ -d .git ]]; then
  git fetch origin
  git checkout "\$BRANCH"
  git pull --ff-only origin "\$BRANCH"
else
  git clone --branch "\$BRANCH" "\$REPO_URL" .
fi

# Node via nvm if present, else system node
export NVM_DIR="\$HOME/.nvm"
[[ -s "\$NVM_DIR/nvm.sh" ]] && . "\$NVM_DIR/nvm.sh"
command -v node >/dev/null || { echo "Node.js required on VPS"; exit 1; }
command -v pnpm >/dev/null || npm install -g pnpm@9

if command -v docker >/dev/null 2>&1; then
  docker compose -f infra/docker-compose.yml up -d
else
  echo "⚠ docker not found — ensure Postgres/Redis already run on this host"
fi

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "⚠ Created .env from example — edit secrets on the VPS before production traffic"
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

pnpm install --frozen-lockfile || pnpm install
pnpm db:migrate || true
pnpm --filter @biab/collab-core build
pnpm --filter @biab/blake-agent build
pnpm --filter @biab/ui build
pnpm --filter @biab/server build
pnpm --filter @biab/web build

# Prefer systemd unit if root and unit exists; else pm2; else nohup
if command -v systemctl >/dev/null && [[ -f infra/deploy/biab-server.service ]]; then
  sudo cp infra/deploy/biab-server.service /etc/systemd/system/biab-server.service
  sudo sed -i "s|__REMOTE_PATH__|\$REMOTE_PATH|g" /etc/systemd/system/biab-server.service
  sudo systemctl daemon-reload
  sudo systemctl enable --now biab-server
  echo "✓ systemd biab-server started"
elif command -v pm2 >/dev/null; then
  pm2 delete biab-server 2>/dev/null || true
  pm2 start pnpm --name biab-server -- --filter @biab/server start
  pm2 delete biab-web 2>/dev/null || true
  pm2 start pnpm --name biab-web -- --filter @biab/web start
  pm2 save || true
  echo "✓ pm2 processes started"
else
  pkill -f "node dist/index.js" 2>/dev/null || true
  nohup pnpm --filter @biab/server start > /tmp/biab-server.log 2>&1 &
  nohup pnpm --filter @biab/web start > /tmp/biab-web.log 2>&1 &
  echo "✓ nohup started (logs in /tmp/biab-*.log)"
fi

sleep 1
curl -fsS "http://127.0.0.1:\${PORT:-4000}/healthz" || echo "healthz not reachable yet"
echo "Deploy finished on \$(hostname)"
REMOTE

echo "✓ Remote deploy script finished for $SSH_TARGET"
