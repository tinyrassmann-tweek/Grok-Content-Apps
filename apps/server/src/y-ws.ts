/**
 * Re-export setupWSConnection from y-websocket CJS utils + Postgres persistence.
 */
import type { IncomingMessage } from "node:http";
import type { WebSocket } from "ws";
import {
  getYUtils,
  installPostgresPersistence,
} from "./y-persistence.js";

let wired = false;

export function wireYWebsocket(): void {
  if (wired) return;
  installPostgresPersistence();
  wired = true;
}

export function setupWSConnection(
  conn: WebSocket,
  req: IncomingMessage,
  opts?: { docName?: string; gc?: boolean }
): void {
  wireYWebsocket();
  const { setupWSConnection: setup } = getYUtils();
  setup(conn, req, opts);
}
