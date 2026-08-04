import * as Y from "yjs";
import { createRequire } from "node:module";
import {
  appendOpLog,
  loadYjsState,
  saveYjsState,
} from "./db.js";

const require = createRequire(import.meta.url);

type YUtils = {
  setPersistence: (p: {
    bindState: (docName: string, ydoc: Y.Doc) => void | Promise<void>;
    writeState: (docName: string, ydoc: Y.Doc) => Promise<unknown>;
    provider?: unknown;
  }) => void;
  setupWSConnection: (
    conn: unknown,
    req: unknown,
    opts?: { docName?: string; gc?: boolean }
  ) => void;
  getYDoc: (docName: string, gc?: boolean) => Y.Doc;
  docs: Map<string, Y.Doc>;
};

let utils: YUtils | null = null;

export function getYUtils(): YUtils {
  if (utils) return utils;
  // y-websocket exports CJS utils at ./bin/utils
  utils = require("y-websocket/bin/utils") as YUtils;
  return utils;
}

/** Debounced full-state writers per doc */
const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();

function scheduleSave(docName: string, ydoc: Y.Doc) {
  const prev = saveTimers.get(docName);
  if (prev) clearTimeout(prev);
  saveTimers.set(
    docName,
    setTimeout(() => {
      const state = Y.encodeStateAsUpdate(ydoc);
      void saveYjsState(docName, state).catch((err) => {
        console.error("[y-persistence] save failed", docName, err);
      });
    }, 800)
  );
}

/**
 * Wire Postgres as the y-websocket persistence layer:
 * - bindState: load artifacts.yjs_state into the live doc
 * - on update: append op_log + debounced full-state write
 */
export function installPostgresPersistence(): void {
  const y = getYUtils();
  y.setPersistence({
    provider: "postgres",
    bindState: async (docName, ydoc) => {
      try {
        const buf = await loadYjsState(docName);
        if (buf && buf.length > 0) {
          Y.applyUpdate(ydoc, new Uint8Array(buf));
        }
      } catch (err) {
        console.error("[y-persistence] load failed", docName, err);
      }

      ydoc.on("update", (update: Uint8Array, origin: unknown) => {
        // Skip empty / non-binary
        if (!update?.length) return;
        const actorKind =
          origin &&
          typeof origin === "object" &&
          (origin as { actorKind?: string }).actorKind === "ai"
            ? "ai"
            : "human";
        const actorId =
          origin &&
          typeof origin === "object" &&
          typeof (origin as { actorId?: string }).actorId === "string"
            ? (origin as { actorId: string }).actorId
            : "unknown";

        void appendOpLog({
          artifactId: docName,
          actorId,
          actorKind,
          update,
        }).catch((err) => {
          console.error("[y-persistence] op_log failed", docName, err);
        });
        scheduleSave(docName, ydoc);
      });
    },
    writeState: async (docName, ydoc) => {
      const state = Y.encodeStateAsUpdate(ydoc);
      await saveYjsState(docName, state);
    },
  });
}

export function getLiveDoc(docName: string): Y.Doc | undefined {
  return getYUtils().docs.get(docName) as Y.Doc | undefined;
}

/** Get or create a shared doc (loads Postgres state via bindState). */
export function getOrCreateDoc(docName: string): Y.Doc {
  return getYUtils().getYDoc(docName, true);
}
