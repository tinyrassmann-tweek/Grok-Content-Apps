import jwt from "jsonwebtoken";
import { config } from "./config.js";
import { pg } from "./db.js";

export type AuthUser = {
  sub: string;
  tenantId: string;
  email?: string;
  name?: string;
  role?: string;
};

export function signToken(
  user: AuthUser,
  expiresIn: string | number = "12h"
): string {
  return jwt.sign(
    {
      sub: user.sub,
      tenantId: user.tenantId,
      email: user.email,
      name: user.name,
      role: user.role ?? "editor",
    },
    config.jwtSecret,
    { expiresIn } as jwt.SignOptions
  );
}

export function verifyToken(token: string): AuthUser {
  const payload = jwt.verify(token, config.jwtSecret) as jwt.JwtPayload;
  if (!payload.sub || !payload.tenantId) {
    throw new Error("invalid token claims");
  }
  return {
    sub: String(payload.sub),
    tenantId: String(payload.tenantId),
    email: payload.email ? String(payload.email) : undefined,
    name: payload.name ? String(payload.name) : undefined,
    role: payload.role ? String(payload.role) : undefined,
  };
}

/**
 * Mint a dev JWT without Clerk. Disabled when NODE_ENV=production
 * unless ALLOW_DEV_AUTH=true.
 */
export async function mintDevToken(opts?: {
  name?: string;
  email?: string;
  artifactId?: string;
}): Promise<{ token: string; user: AuthUser; expiresIn: string }> {
  if (!config.allowDevAuth) {
    throw new Error("dev auth disabled");
  }

  const user: AuthUser = {
    sub: config.devUserSub,
    tenantId: config.devTenantId,
    email: opts?.email ?? config.devUserEmail,
    name: opts?.name ?? config.devUserName,
    role: "director",
  };

  // Ensure seed rows exist (idempotent)
  await pg.query(
    `INSERT INTO tenants (id, name, stream, hipaa_mode)
     VALUES ($1, 'Think Tank Solutions AI', 'think_tank', false)
     ON CONFLICT (id) DO NOTHING`,
    [config.devTenantId]
  );
  await pg.query(
    `INSERT INTO users (id, tenant_id, email, oauth_sub, role)
     VALUES ('22222222-2222-2222-2222-222222222222', $1, $2, $3, 'director')
     ON CONFLICT (email) DO NOTHING`,
    [config.devTenantId, user.email, user.sub]
  );

  if (opts?.artifactId) {
    await pg.query(
      `INSERT INTO artifacts (id, tenant_id, kind, title, acl, hipaa_local_only)
       VALUES ($1, $2, 'doc', $1, '{}'::jsonb, false)
       ON CONFLICT (id) DO NOTHING`,
      [opts.artifactId, config.devTenantId]
    );
  }

  return {
    token: signToken(user),
    user,
    expiresIn: "12h",
  };
}
