# Hostinger VPS deploy

## Prerequisites on the VPS

- Ubuntu/Debian (Hostinger KVM/VPS)
- Node 20+
- Git, curl
- Docker **or** system Postgres 16 + Redis 7
- SSH key access from this Mac

## One-time VPS prep

```bash
ssh root@YOUR.VPS.IP
# install node 20 (example via nodesource or nvm)
curl -fsSL https://get.docker.com | sh   # optional if using docker compose
```

## Configure local env

```bash
cd ~/Grok-Content-Apps
cp .env.example .env
# set at least:
#   HOSTINGER_SSH=root@YOUR.VPS.IP
#   JWT_SECRET=...
#   ANTHROPIC_API_KEY=...
#   NEXT_PUBLIC_API_URL=http://YOUR.VPS.IP:4000
#   NEXT_PUBLIC_WS_URL=ws://YOUR.VPS.IP:4000/collab
```

## Deploy

```bash
export HOSTINGER_SSH=root@YOUR.VPS.IP
pnpm deploy:hostinger
```

## Smoke test

```bash
curl http://YOUR.VPS.IP:4000/healthz
# {"ok":true,"brand":"TTSAI",...}
```

## Production notes

- Set `NODE_ENV=production` and `ALLOW_DEV_AUTH=false` once Clerk is live.
- Put Nginx/Caddy in front for TLS; proxy `/collab` with WebSocket upgrade.
- Keep `.env` only on the VPS — never commit secrets.
