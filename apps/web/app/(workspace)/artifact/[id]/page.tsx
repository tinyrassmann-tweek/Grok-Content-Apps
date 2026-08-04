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

export default function Artifact({ params }: { params: { id: string } }) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"connecting" | "connected" | "offline">(
    "connecting"
  );
  const docRef = useRef<Y.Doc>();

  useEffect(() => {
    const doc = new Y.Doc();
    docRef.current = doc;
    new IndexeddbPersistence(`biab-${params.id}`, doc);

    const wsUrl =
      process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:4000/collab";
    const token =
      typeof window !== "undefined"
        ? window.__BIAB_TOKEN__ ?? "dev-token"
        : "dev-token";

    const ws = new WebsocketProvider(wsUrl, params.id, doc, {
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
    ws.awareness.setLocalStateField("user", {
      name: "Tiny",
      color: "#0A2540",
    });

    return () => {
      ws.destroy();
      doc.destroy();
    };
  }, [params.id]);

  return (
    <main className="max-w-3xl mx-auto p-6">
      <div className="flex items-baseline justify-between mb-4 gap-4">
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
      <textarea
        className="w-full h-96 border border-[#D6D3CC] rounded-lg p-4 bg-white text-[#36454F] focus:outline-none focus:ring-2 focus:ring-[#0A2540]/30"
        value={text}
        onChange={(e) => {
          const yText = docRef.current!.getText("body");
          docRef.current!.transact(() => {
            yText.delete(0, yText.length);
            yText.insert(0, e.target.value);
          });
        }}
        placeholder="Start collaborating…"
      />
    </main>
  );
}
