/**
 * Thin adapter around y-websocket's setupWSConnection.
 * y-websocket v2 exposes utilities under bin/utils — path can shift by version.
 */
import type { IncomingMessage } from "node:http";
import type { WebSocket } from "ws";

type SetupOpts = { docName?: string; gc?: boolean };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SetupFn = (conn: any, req: IncomingMessage, opts?: SetupOpts) => void;

let setup: SetupFn | null = null;

async function loadSetup(): Promise<SetupFn> {
  if (setup) return setup;
  const candidates = [
    "y-websocket/bin/utils.js",
    "y-websocket/bin/utils",
    "y-websocket/utils",
  ];
  for (const id of candidates) {
    try {
      const mod = await import(id);
      if (typeof mod.setupWSConnection === "function") {
        setup = mod.setupWSConnection as SetupFn;
        return setup;
      }
    } catch {
      // try next
    }
  }
  // Minimal fallback: accept socket but do not sync (keeps server bootable)
  setup = (conn) => {
    conn?.close?.(1011, "y-websocket utils not found");
  };
  return setup;
}

export function setupWSConnection(
  conn: WebSocket,
  req: IncomingMessage,
  opts?: SetupOpts
): void {
  void loadSetup().then((fn) => fn(conn, req, opts));
}
