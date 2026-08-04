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
# Requires Node 20+, pnpm 9, Docker (for Postgres + Redis)
pnpm install
pnpm db:up
# set DATABASE_URL then:
pnpm db:migrate
cp .env.example .env   # fill secrets
pnpm dev
```

## Production

```bash
pnpm --filter @biab/server build && pnpm --filter @biab/server start
pnpm --filter @biab/web build && pnpm --filter @biab/web start
pnpm --filter @biab/mobile exec eas build --platform all
```

## Smoke test

```bash
curl http://YOUR-HOSTINGER-IP:4000/healthz
# expect: {"ok":true,"brand":"TTSAI"}
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
