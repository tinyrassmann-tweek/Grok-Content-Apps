import { Pool } from "pg";
import { config } from "./config.js";

export const pg = new Pool({ connectionString: config.databaseUrl });

export async function ensureArtifact(
  artifactId: string,
  tenantId: string,
  title = artifactId
): Promise<void> {
  await pg.query(
    `INSERT INTO artifacts (id, tenant_id, kind, title, acl, hipaa_local_only)
     VALUES ($1, $2, 'doc', $3, '{}'::jsonb, false)
     ON CONFLICT (id) DO NOTHING`,
    [artifactId, tenantId, title]
  );
}

export async function loadYjsState(
  artifactId: string
): Promise<Buffer | null> {
  const r = await pg.query<{ yjs_state: Buffer | null }>(
    "SELECT yjs_state FROM artifacts WHERE id = $1",
    [artifactId]
  );
  return r.rows[0]?.yjs_state ?? null;
}

export async function saveYjsState(
  artifactId: string,
  state: Uint8Array
): Promise<void> {
  await pg.query(
    `UPDATE artifacts SET yjs_state = $2, updated_at = now() WHERE id = $1`,
    [artifactId, Buffer.from(state)]
  );
}

export async function appendOpLog(opts: {
  artifactId: string;
  actorId: string;
  actorKind: "human" | "ai";
  update: Uint8Array;
}): Promise<void> {
  await pg.query(
    `INSERT INTO op_log (artifact_id, actor_id, actor_kind, update)
     VALUES ($1, $2, $3, $4)`,
    [
      opts.artifactId,
      opts.actorId,
      opts.actorKind,
      Buffer.from(opts.update),
    ]
  );
}

export async function getArtifactMeta(artifactId: string, tenantId: string) {
  const r = await pg.query<{
    acl: unknown;
    hipaa_local_only: boolean;
    tenant_id: string;
  }>(
    `SELECT a.acl, a.hipaa_local_only, a.tenant_id
     FROM artifacts a
     WHERE a.id = $1 AND a.tenant_id = $2`,
    [artifactId, tenantId]
  );
  return r.rows[0] ?? null;
}

export async function audit(opts: {
  tenantId: string;
  actorId: string;
  event: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  await pg.query(
    `INSERT INTO audit_log (tenant_id, actor_id, event, payload)
     VALUES ($1, $2, $3, $4)`,
    [opts.tenantId, opts.actorId, opts.event, JSON.stringify(opts.payload)]
  );
}
