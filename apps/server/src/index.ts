import Fastify from "fastify";
import websocket from "@fastify/websocket";
import cors from "@fastify/cors";
import type { WebSocket } from "ws";
import type { IncomingMessage } from "node:http";
import { config } from "./config.js";
import { verifyToken, mintDevToken } from "./auth.js";
import { ensureArtifact, getArtifactMeta, pg } from "./db.js";
import { initPresence, presenceAdd, presenceRemove, presenceList } from "./presence.js";
import { setupWSConnection, wireYWebsocket } from "./y-ws.js";
import { registerBlakeRoutes } from "./blake-routes.js";

const app = Fastify({ logger: true });

initPresence(app.log);
wireYWebsocket();

await app.register(cors, {
  origin: true,
  credentials: true,
});
await app.register(websocket);

app.get("/healthz", async () => ({
  ok: true,
  brand: "TTSAI",
  devAuth: config.allowDevAuth,
}));

/** Dev JWT mint — no Clerk required */
app.post<{
  Body: { name?: string; email?: string; artifactId?: string };
}>("/auth/dev-token", async (req, reply) => {
  if (!config.allowDevAuth) {
    return reply.code(403).send({ error: "dev auth disabled in production" });
  }
  try {
    const result = await mintDevToken(req.body ?? {});
    return {
      ok: true,
      token: result.token,
      user: result.user,
      expiresIn: result.expiresIn,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "mint failed";
    return reply.code(500).send({ error: message });
  }
});

app.get("/auth/dev-token", async (req, reply) => {
  if (!config.allowDevAuth) {
    return reply.code(403).send({ error: "dev auth disabled in production" });
  }
  const q = req.query as { artifactId?: string };
  try {
    const result = await mintDevToken({ artifactId: q.artifactId });
    return {
      ok: true,
      token: result.token,
      user: result.user,
      expiresIn: result.expiresIn,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "mint failed";
    return reply.code(500).send({ error: message });
  }
});

app.get<{ Params: { artifactId: string } }>(
  "/presence/:artifactId",
  async (req) => {
    const users = await presenceList(req.params.artifactId);
    return { artifactId: req.params.artifactId, users };
  }
);

app.get(
  "/collab/:artifactId",
  { websocket: true },
  (socket: WebSocket, req) => {
    const token = (req.query as { token?: string }).token ?? "";
    let user: ReturnType<typeof verifyToken>;

    try {
      user = verifyToken(token);
    } catch {
      socket.close(4401, "unauthorized");
      return;
    }

    const artifactId = (req.params as { artifactId: string }).artifactId;
    const rawReq = req.raw as IncomingMessage;

    void (async () => {
      try {
        // Auto-provision artifact for the tenant (dev-friendly)
        await ensureArtifact(artifactId, user.tenantId);
        const meta = await getArtifactMeta(artifactId, user.tenantId);
        if (!meta) {
          socket.close(4403, "forbidden");
          return;
        }
        if (meta.hipaa_local_only && !req.headers["x-lan-token"]) {
          socket.close(4403, "hipaa_lan_only");
          return;
        }

        setupWSConnection(socket, rawReq, { docName: artifactId });
        await presenceAdd(artifactId, user.sub);
        socket.on("close", () => {
          void presenceRemove(artifactId, user.sub);
        });
      } catch (err) {
        app.log.error(err);
        socket.close(4500, "server_error");
      }
    })();
  }
);

await registerBlakeRoutes(app);

// Fail fast if DB unreachable
try {
  await pg.query("SELECT 1");
  app.log.info("postgres connected");
} catch (err) {
  app.log.error(err);
  app.log.error("DATABASE_URL unreachable — start Postgres / run migrations");
  process.exit(1);
}

try {
  await app.listen({ port: config.port, host: "0.0.0.0" });
  app.log.info(
    `B.i.a.B collab server on :${config.port} (devAuth=${config.allowDevAuth})`
  );
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
