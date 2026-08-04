-- B.i.a.B collab — initial schema
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  stream TEXT,                     -- genesis | think_tank | digital_store | ancestry | trading | god_fund
  hipaa_mode BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  email TEXT UNIQUE NOT NULL,
  oauth_sub TEXT UNIQUE,
  role TEXT DEFAULT 'editor',      -- director | partner | manager | editor | commenter | viewer | guest | ai_agent | genesis_clinical
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Artifact ids are TEXT so human-friendly slugs (demo, demo-artifact) work in URLs.
CREATE TABLE IF NOT EXISTS artifacts (
  id TEXT PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  kind TEXT NOT NULL,              -- project | task | doc | care_plan | listing | trading_strategy | campaign | app_spec
  title TEXT,
  acl JSONB DEFAULT '{}',
  hipaa_local_only BOOLEAN DEFAULT false,
  yjs_state BYTEA,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS op_log (
  id BIGSERIAL PRIMARY KEY,
  artifact_id TEXT REFERENCES artifacts(id),
  actor_id TEXT,
  actor_kind TEXT,                 -- human | ai
  update BYTEA NOT NULL,
  ts TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID,
  actor_id TEXT,
  event TEXT,
  payload JSONB,
  prev_hash TEXT,
  hash TEXT,
  ts TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS artifacts_tenant_kind_idx ON artifacts (tenant_id, kind);
CREATE INDEX IF NOT EXISTS op_log_artifact_ts_idx ON op_log (artifact_id, ts);
