#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# Prefer DATABASE_URL; fall back to local biab DB (peer or password)
URL="${DATABASE_URL:-postgres://biab:biab@localhost:5432/biab}"

# If URL has biab:biab and peer auth works as current user, use plain db name
if psql -d biab -c "SELECT 1" >/dev/null 2>&1; then
  PSQL=(psql -d biab -v ON_ERROR_STOP=1)
else
  PSQL=(psql "$URL" -v ON_ERROR_STOP=1)
fi

echo "→ Applying 001_init.sql"
"${PSQL[@]}" -f "$ROOT/infra/migrations/001_init.sql"
echo "→ Applying 002_seed_dev.sql"
"${PSQL[@]}" -f "$ROOT/infra/migrations/002_seed_dev.sql"
echo "✓ Migrations complete"
