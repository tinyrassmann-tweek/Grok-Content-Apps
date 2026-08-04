# Think Tank Solutions AI — B.i.a.B Collab

**Grok Content Apps** monorepo for real-time collaborative artifacts (Yjs CRDT), web PWA, mobile (Expo), and Blake (TTSAI AI agent).

> Intelligence, precisely applied. Results, rigorously measured.

## Stack

| Layer | Tech |
| --- | --- |
| Web / PWA | Next.js 14 (App Router), Clerk, Tailwind, y-websocket, y-indexeddb |
| Mobile | Expo (React Native), y-websocket, SecureStore |
| Server | Fastify, y-websocket, Postgres 16, Redis 7, JWT |
| Shared | Yjs CRDT (`collab-core`), Blake agent (`blake-agent`), design tokens (`ui`) |
| AI | Anthropic Claude Sonnet (Blake); Ollama local when HIPAA mode |
| Deploy | Hostinger VPS · $0 net-new spend |

## Repository layout

```
tts-biab-collab/
├─ apps/
│  ├─ web/                  # Next.js 14 webapp + PWA
│  ├─ mobile/               # Expo (React Native) iOS + Android
│  └─ server/               # Fastify + y-websocket + Postgres + Redis
├─ packages/
│  ├─ collab-core/          # Shared Yjs schema + presence + ACL
│  ├─ blake-agent/          # Blake (TTSAI) participant adapter
│  └─ ui/                   # Shared design tokens (TTSAI brand)
├─ infra/
│  ├─ docker-compose.yml
│  └─ migrations/
├─ package.json             # pnpm workspaces
└─ turbo.json
```

## Bootstrap (local / VPS)

```bash
# Requires Node 20+, pnpm 9; Postgres (Docker or local); Redis optional
pnpm install
pnpm db:up            # docker compose Postgres+Redis (if Docker available)
pnpm db:migrate       # 001_init + 002_seed_dev
cp .env.example .env  # fill JWT_SECRET, ANTHROPIC_API_KEY, etc.
pnpm dev
```

### Dev auth (no Clerk)

```bash
curl 'http://localhost:4000/auth/dev-token?artifactId=demo'
# → { ok, token, user }
```

Web/mobile auto-mint a dev JWT and attach it to the collab WebSocket.
Disable in production: `NODE_ENV=production` and `ALLOW_DEV_AUTH=false`.

### Yjs persistence

Live docs sync via `y-websocket`. On every update the server:

1. Appends the update bytes to `op_log`
2. Debounces a full-state write to `artifacts.yjs_state`

### Blake

| Mode | Path | Env |
| --- | --- | --- |
| Non-HIPAA | Anthropic Messages API | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` |
| HIPAA | Local Ollama | `OLLAMA_URL`, `OLLAMA_MODEL` |

```bash
# propose (returns suggestion; does not edit body until commit)
curl -X POST http://localhost:4000/blake/propose \
  -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"artifactId":"demo","prompt":"Outline next steps","hipaaMode":false}'

# commit after human approval
curl -X POST http://localhost:4000/blake/commit \
  -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"artifactId":"demo","opId":"<opId>","mode":"append"}'
```

## Production / Hostinger

```bash
export HOSTINGER_SSH=root@YOUR.VPS.IP
pnpm deploy:hostinger
# details: infra/deploy/README.md
```

```bash
pnpm --filter @biab/server build && pnpm --filter @biab/server start
pnpm --filter @biab/web build && pnpm --filter @biab/web start
pnpm --filter @biab/mobile exec eas build --platform all
```

## Smoke test

```bash
curl http://localhost:4000/healthz
# expect: {"ok":true,"brand":"TTSAI","devAuth":true}
```

## Packages

| Package | Name | Role |
| --- | --- | --- |
| `apps/web` | `@biab/web` | Next.js 14 PWA workspace |
| `apps/mobile` | `@biab/mobile` | Expo collab client |
| `apps/server` | `@biab/server` | Collab API + y-websocket |
| `packages/collab-core` | `@biab/collab-core` | Yjs doc schema + palette |
| `packages/blake-agent` | `@biab/blake-agent` | Blake AI participant |
| `packages/ui` | `@biab/ui` | TTSAI brand tokens |

## Brand (TTSAI)

- Navy: `#0A2540`
- Gold: `#D4AF37`
- Charcoal: `#36454F`
- Canvas: `#FAF9F7`
- Type: Inter (UI) · Playfair Display (display)

## License

Private / proprietary — Think Tank Solutions AI.
