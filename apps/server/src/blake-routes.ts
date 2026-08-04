import type { FastifyInstance } from "fastify";
import * as Y from "yjs";
import { BlakeAgent } from "@biab/blake-agent";
import { config } from "./config.js";
import { verifyToken } from "./auth.js";
import { audit, ensureArtifact, getArtifactMeta } from "./db.js";
import { getLiveDoc, getOrCreateDoc } from "./y-persistence.js";

type BodyPropose = {
  artifactId: string;
  prompt: string;
  hipaaMode?: boolean;
  token?: string;
};

type BodyCommit = {
  artifactId: string;
  opId: string;
  mode?: "append" | "replace";
  token?: string;
};

function authFromRequest(req: {
  headers: Record<string, unknown>;
  body?: { token?: string };
}): ReturnType<typeof verifyToken> {
  const header = String(req.headers.authorization ?? "");
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : "";
  const token = bearer || req.body?.token || "";
  if (!token) throw new Error("missing token");
  return verifyToken(token);
}

function agentForDoc(doc: Y.Doc, tenantId: string, hipaaMode: boolean) {
  return new BlakeAgent(
    {
      apiKey: config.anthropicApiKey,
      model: config.anthropicModel,
      scopes: ["read", "suggest", "edit"],
      tenantId,
      hipaaMode,
      ollamaUrl: config.ollamaUrl,
      ollamaModel: config.ollamaModel,
    },
    doc
  );
}

/** Ensure a Y.Doc exists in the y-websocket docs map (loads persistence). */
function ensureLiveDoc(artifactId: string): Y.Doc {
  return getOrCreateDoc(artifactId);
}

export async function registerBlakeRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: BodyPropose }>("/blake/propose", async (req, reply) => {
    try {
      const user = authFromRequest(req);
      const { artifactId, prompt, hipaaMode = false } = req.body ?? {};
      if (!artifactId || !prompt) {
        return reply.code(400).send({ error: "artifactId and prompt required" });
      }

      await ensureArtifact(artifactId, user.tenantId);
      const meta = await getArtifactMeta(artifactId, user.tenantId);
      if (!meta) return reply.code(403).send({ error: "forbidden" });

      const effectiveHipaa = Boolean(hipaaMode || meta.hipaa_local_only);
      const doc = ensureLiveDoc(artifactId);
      // wait a tick for optional state load
      await new Promise((r) => setTimeout(r, 50));

      const agent = agentForDoc(doc, user.tenantId, effectiveHipaa);
      const result = await agent.propose(prompt);

      // Keep agent pending on process memory keyed by opId via singleton map on doc
      // Stash agent on doc for commit
      (doc as unknown as { __blake?: BlakeAgent }).__blake = agent;

      await audit({
        tenantId: user.tenantId,
        actorId: user.sub,
        event: "blake.propose",
        payload: {
          artifactId,
          opId: result.opId,
          path: result.path,
          hipaa: effectiveHipaa,
        },
      });

      return {
        ok: true,
        ...result,
        awareness: agent.awareness(),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "propose failed";
      const code = message.includes("dev auth") ? 403 : 400;
      return reply.code(code).send({ error: message });
    }
  });

  app.post<{ Body: BodyCommit }>("/blake/commit", async (req, reply) => {
    try {
      const user = authFromRequest(req);
      const { artifactId, opId, mode = "append" } = req.body ?? {};
      if (!artifactId || !opId) {
        return reply.code(400).send({ error: "artifactId and opId required" });
      }

      const meta = await getArtifactMeta(artifactId, user.tenantId);
      if (!meta) return reply.code(403).send({ error: "forbidden" });

      const doc = getLiveDoc(artifactId) ?? ensureLiveDoc(artifactId);
      const agent =
        (doc as unknown as { __blake?: BlakeAgent }).__blake ??
        agentForDoc(doc, user.tenantId, false);

      // If agent was recreated, pending map is empty — recover from fields
      if (!agent.getPending(opId)) {
        const pending = doc.getMap("fields").get("blake_pending") as
          | {
              opId?: string;
              suggestion?: string;
              prompt?: string;
              model?: string;
              path?: "anthropic" | "ollama";
              createdAt?: number;
            }
          | undefined;
        if (pending?.opId === opId && pending.suggestion) {
          agent.rehydratePending({
            opId,
            prompt: pending.prompt ?? "",
            suggestion: pending.suggestion,
            createdAt: pending.createdAt ?? Date.now(),
            model: pending.model ?? "recovered",
            path: pending.path ?? "anthropic",
          });
        }
      }

      const result = await agent.commitIfAuthorized(opId, user.sub, mode);

      // Persist after AI commit
      const state = Y.encodeStateAsUpdate(doc);
      const { saveYjsState, appendOpLog } = await import("./db.js");
      await saveYjsState(artifactId, state);
      await appendOpLog({
        artifactId,
        actorId: "blake",
        actorKind: "ai",
        update: state,
      });

      await audit({
        tenantId: user.tenantId,
        actorId: user.sub,
        event: "blake.commit",
        payload: { artifactId, opId, mode },
      });

      return { ok: true, ...result };
    } catch (err) {
      const message = err instanceof Error ? err.message : "commit failed";
      return reply.code(400).send({ error: message });
    }
  });
}
