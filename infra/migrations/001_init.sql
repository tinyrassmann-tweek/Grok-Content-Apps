-- B.i.a.B collab — initial schema
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  stream TEXT,                     -- genesis | think_tank | digital_store | ancestry | trading | god_fund
  hipaa_mode BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  email TEXT UNIQUE NOT NULL,
  oauth_sub TEXT UNIQUE,
  role TEXT DEFAULT 'editor',      -- director | partner | manager | editor | commenter | viewer | guest | ai_agent | genesis_clinical
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  kind TEXT NOT NULL,              -- project | task | doc | care_plan | listing | trading_strategy | campaign | app_spec
  title TEXT,
  acl JSONB DEFAULT '{}',
  hipaa_local_only BOOLEAN DEFAULT false,
  yjs_state BYTEA,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE op_log (
  id BIGSERIAL PRIMARY KEY,
  artifact_id UUID REFERENCES artifacts(id),
  actor_id UUID,
  actor_kind TEXT,                 -- human | ai
  update BYTEA NOT NULL,
  ts TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID,
  actor_id UUID,
  event TEXT,
  payload JSONB,
  prev_hash TEXT,
  hash TEXT,
  ts TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX artifacts_tenant_kind_idx ON artifacts (tenant_id, kind);
CREATE INDEX op_log_artifact_ts_idx ON op_log (artifact_id, ts);
