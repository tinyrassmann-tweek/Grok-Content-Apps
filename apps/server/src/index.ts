import Fastify from "fastify";
import websocket from "@fastify/websocket";
import { Pool } from "pg";
import { Redis } from "ioredis";
import jwt from "jsonwebtoken";
import type { WebSocket } from "ws";
import type { IncomingMessage } from "node:http";
import { setupWSConnection } from "./y-ws.js";

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgres://biab:biab@localhost:5432/biab";
const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
const JWT_SECRET = process.env.JWT_SECRET ?? "dev-only-replace-me-32-bytes!!";
const PORT = Number(process.env.PORT ?? 4000);

const pg = new Pool({ connectionString: DATABASE_URL });
const redis = new Redis(REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
});

const app = Fastify({ logger: true });
redis.on("error", (err) => {
  app.log.warn({ err: err.message }, "redis");
});
void redis.connect().catch(() => {
  app.log.warn(
    "redis unavailable — presence tracking disabled until Redis is up"
  );
});
await app.register(websocket);

app.get("/healthz", async () => ({ ok: true, brand: "TTSAI" }));

app.get(
  "/collab/:artifactId",
  { websocket: true },
  (socket: WebSocket, req) => {
    const token = (req.query as { token?: string }).token ?? "";
    let user: { sub: string; tenantId: string };

    try {
      user = jwt.verify(token, JWT_SECRET) as {
        sub: string;
        tenantId: string;
      };
    } catch {
      socket.close(4401, "unauthorized");
      return;
    }

    const artifactId = (req.params as { artifactId: string }).artifactId;
    const rawReq = req.raw as IncomingMessage;

    pg.query(
      "SELECT acl, hipaa_local_only FROM artifacts WHERE id=$1 AND tenant_id=$2",
      [artifactId, user.tenantId]
    )
      .then((r) => {
        if (r.rowCount === 0) {
          socket.close(4403, "forbidden");
          return;
        }
        if (r.rows[0].hipaa_local_only && !req.headers["x-lan-token"]) {
          socket.close(4403, "hipaa_lan_only");
          return;
        }

        setupWSConnection(socket, rawReq, { docName: artifactId });
        void redis.sadd(`presence:${artifactId}`, user.sub);
        socket.on("close", () => {
          void redis.srem(`presence:${artifactId}`, user.sub);
        });
      })
      .catch((err) => {
        app.log.error(err);
        socket.close(4500, "server_error");
      });
  }
);

try {
  await app.listen({ port: PORT, host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
