"use client";

import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { IndexeddbPersistence } from "y-indexeddb";

declare global {
  interface Window {
    __BIAB_TOKEN__?: string;
  }
}

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const WS_BASE =
  process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:4000/collab";

async function mintDevToken(artifactId: string): Promise<string> {
  const res = await fetch(
    `${API_URL}/auth/dev-token?artifactId=${encodeURIComponent(artifactId)}`
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { error?: string }).error ?? `dev-token HTTP ${res.status}`
    );
  }
  const data = (await res.json()) as { token: string };
  return data.token;
}

export default function Artifact({ params }: { params: { id: string } }) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<
    "auth" | "connecting" | "connected" | "offline" | "error"
  >("auth");
  const [error, setError] = useState<string | null>(null);
  const [blakePrompt, setBlakePrompt] = useState(
    "Summarize this document in 3 crisp bullets."
  );
  const [blakeBusy, setBlakeBusy] = useState(false);
  const [blakeNote, setBlakeNote] = useState<string | null>(null);
  const [pendingOpId, setPendingOpId] = useState<string | null>(null);
  const docRef = useRef<Y.Doc>();
  const tokenRef = useRef<string>("");

  useEffect(() => {
    let cancelled = false;
    let ws: WebsocketProvider | undefined;
    let doc: Y.Doc | undefined;

    (async () => {
      try {
        setStatus("auth");
        const token =
          (typeof window !== "undefined" && window.__BIAB_TOKEN__) ||
          (await mintDevToken(params.id));
        if (cancelled) return;
        tokenRef.current = token;
        window.__BIAB_TOKEN__ = token;

        doc = new Y.Doc();
        docRef.current = doc;
        new IndexeddbPersistence(`biab-${params.id}`, doc);

        setStatus("connecting");
        ws = new WebsocketProvider(WS_BASE, params.id, doc, {
          params: { token },
          connect: true,
        });

        ws.on("status", (event: { status: string }) => {
          if (event.status === "connected") setStatus("connected");
          else if (event.status === "disconnected") setStatus("offline");
          else setStatus("connecting");
        });

        const yText = doc.getText("body");
        const update = () => setText(yText.toString());
        yText.observe(update);
        update();

        const fields = doc.getMap("fields");
        const syncPending = () => {
          const p = fields.get("blake_pending") as
            | { opId?: string; suggestion?: string }
            | undefined;
          if (p?.opId) {
            setPendingOpId(p.opId);
            if (p.suggestion) setBlakeNote(p.suggestion);
          } else {
            setPendingOpId(null);
          }
        };
        fields.observe(syncPending);
        syncPending();

        ws.awareness.setLocalStateField("user", {
          name: "Tiny",
          color: "#0A2540",
        });
      } catch (e) {
        if (cancelled) return;
        setStatus("error");
        setError(e instanceof Error ? e.message : "failed to connect");
      }
    })();

    return () => {
      cancelled = true;
      ws?.destroy();
      doc?.destroy();
    };
  }, [params.id]);

  async function askBlake() {
    setBlakeBusy(true);
    setBlakeNote(null);
    try {
      const res = await fetch(`${API_URL}/blake/propose`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${tokenRef.current}`,
        },
        body: JSON.stringify({
          artifactId: params.id,
          prompt: blakePrompt,
          hipaaMode: false,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "propose failed");
      setPendingOpId(data.opId);
      setBlakeNote(data.suggestion);
    } catch (e) {
      setBlakeNote(e instanceof Error ? e.message : "Blake error");
    } finally {
      setBlakeBusy(false);
    }
  }

  async function commitBlake() {
    if (!pendingOpId) return;
    setBlakeBusy(true);
    try {
      const res = await fetch(`${API_URL}/blake/commit`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${tokenRef.current}`,
        },
        body: JSON.stringify({
          artifactId: params.id,
          opId: pendingOpId,
          mode: "append",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "commit failed");
      setBlakeNote("Committed to document.");
      setPendingOpId(null);
    } catch (e) {
      setBlakeNote(e instanceof Error ? e.message : "Commit error");
    } finally {
      setBlakeBusy(false);
    }
  }

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-4">
      <div className="flex items-baseline justify-between gap-4">
        <h1
          style={{ fontFamily: "Playfair Display, serif", color: "#0A2540" }}
          className="text-3xl font-semibold"
        >
          Artifact {params.id}
        </h1>
        <span className="text-xs uppercase tracking-wide text-[#8A8D91]">
          {status}
        </span>
      </div>

      {error && (
        <p className="text-sm text-[#A84B2F] border border-[#A84B2F]/30 rounded-lg p-3 bg-white">
          {error}
        </p>
      )}

      <textarea
        className="w-full h-80 border border-[#D6D3CC] rounded-lg p-4 bg-white text-[#36454F] focus:outline-none focus:ring-2 focus:ring-[#0A2540]/30"
        value={text}
        onChange={(e) => {
          const yText = docRef.current?.getText("body");
          if (!yText || !docRef.current) return;
          docRef.current.transact(() => {
            yText.delete(0, yText.length);
            yText.insert(0, e.target.value);
          });
        }}
        placeholder="Start collaborating…"
        disabled={status === "auth" || status === "error"}
      />

      <section className="border border-[#D6D3CC] rounded-lg p-4 bg-white space-y-3">
        <div className="flex items-center justify-between">
          <h2
            className="text-lg font-semibold text-[#0A2540]"
            style={{ fontFamily: "Playfair Display, serif" }}
          >
            Blake (TTSAI)
          </h2>
          <span className="text-xs text-[#D4AF37] font-medium">AI collaborator</span>
        </div>
        <textarea
          className="w-full h-20 border border-[#D6D3CC] rounded-md p-3 text-sm text-[#36454F]"
          value={blakePrompt}
          onChange={(e) => setBlakePrompt(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void askBlake()}
            disabled={blakeBusy || status === "error"}
            className="rounded-md bg-[#0A2540] text-white text-sm px-4 py-2 disabled:opacity-50"
          >
            {blakeBusy ? "Thinking…" : "Propose"}
          </button>
          <button
            type="button"
            onClick={() => void commitBlake()}
            disabled={blakeBusy || !pendingOpId}
            className="rounded-md bg-[#D4AF37] text-[#0A2540] text-sm font-medium px-4 py-2 disabled:opacity-50"
          >
            Commit suggestion
          </button>
        </div>
        {blakeNote && (
          <pre className="text-sm whitespace-pre-wrap text-[#36454F] bg-[#FAF9F7] border border-[#D6D3CC] rounded-md p-3 max-h-48 overflow-auto">
            {blakeNote}
          </pre>
        )}
      </section>
    </main>
  );
}
