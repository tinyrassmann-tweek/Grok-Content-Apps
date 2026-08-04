import * as Y from "yjs";

export type BlakeScope = "read" | "suggest" | "edit" | "deploy";

export interface BlakeConfig {
  apiKey: string; // ANTHROPIC_API_KEY (ignored when hipaaMode)
  model: string; // e.g. claude-sonnet-4-20250514
  scopes: BlakeScope[];
  tenantId: string;
  hipaaMode: boolean; // if true, route through local Ollama only
  ollamaUrl?: string; // default http://localhost:11434
  ollamaModel?: string; // default llama3.2
}

export interface PendingProposal {
  opId: string;
  prompt: string;
  suggestion: string;
  createdAt: number;
  model: string;
  path: "anthropic" | "ollama";
}

export class BlakeAgent {
  private pending = new Map<string, PendingProposal>();

  constructor(
    private cfg: BlakeConfig,
    private doc: Y.Doc
  ) {}

  awareness() {
    return {
      userId: "blake",
      name: "Blake (TTSAI)",
      color: "#D4AF37",
      isAI: true as const,
    };
  }

  listPending(): PendingProposal[] {
    return [...this.pending.values()];
  }

  getPending(opId: string): PendingProposal | undefined {
    return this.pending.get(opId);
  }

  /** Restore a pending proposal (e.g. after process recycle from doc fields). */
  rehydratePending(proposal: PendingProposal): void {
    this.pending.set(proposal.opId, proposal);
  }

  /**
   * Ask Blake for a suggestion. Does not mutate the document body until
   * commitIfAuthorized — writes a pending proposal into meta fields.
   */
  async propose(
    prompt: string
  ): Promise<{ accepted: boolean; opId: string; suggestion: string; path: string }> {
    if (
      !this.cfg.scopes.includes("suggest") &&
      !this.cfg.scopes.includes("edit") &&
      !this.cfg.scopes.includes("read")
    ) {
      throw new Error("scope:read|suggest|edit required");
    }

    const body = this.doc.getText("body").toString();
    const context = body.slice(0, 12_000);
    const system = [
      "You are Blake (TTSAI), a collaborative AI participant on Think Tank Solutions AI's B.i.a.B workspace.",
      "Respond with concrete, high-signal text suitable for inserting into a shared document.",
      "Do not wrap the answer in markdown fences unless the user asked for code.",
      "Be concise and professional; brand voice: intelligence, precisely applied.",
    ].join(" ");

    const userMsg = context
      ? `Current document:\n---\n${context}\n---\n\nRequest: ${prompt}`
      : `Request: ${prompt}`;

    let suggestion: string;
    let path: "anthropic" | "ollama";
    let model: string;

    if (this.cfg.hipaaMode) {
      path = "ollama";
      model = this.cfg.ollamaModel ?? "llama3.2";
      suggestion = await this.callOllama(system, userMsg, model);
    } else {
      path = "anthropic";
      model = this.cfg.model;
      if (!this.cfg.apiKey) {
        throw new Error("ANTHROPIC_API_KEY required when hipaaMode=false");
      }
      suggestion = await this.callAnthropic(system, userMsg, model);
    }

    const opId = globalThis.crypto.randomUUID();
    const proposal: PendingProposal = {
      opId,
      prompt,
      suggestion,
      createdAt: Date.now(),
      model,
      path,
    };
    this.pending.set(opId, proposal);

    // Surface pending proposal on the shared doc (does not edit body)
    this.doc.transact(() => {
      const fields = this.doc.getMap("fields");
      fields.set("blake_pending", {
        opId,
        prompt,
        suggestion,
        model,
        path,
        createdAt: proposal.createdAt,
      });
    }, { actorId: "blake", actorKind: "ai" });

    return { accepted: false, opId, suggestion, path };
  }

  /**
   * Apply a pending proposal to the document body after human approval.
   * Append mode by default (safer for collab).
   */
  async commitIfAuthorized(
    opId: string,
    approver: string,
    mode: "append" | "replace" = "append"
  ): Promise<{ committed: boolean; opId: string }> {
    if (!this.cfg.scopes.includes("edit")) {
      throw new Error("scope:edit required");
    }
    const proposal = this.pending.get(opId);
    if (!proposal) {
      throw new Error(`unknown opId: ${opId}`);
    }

    this.doc.transact(() => {
      const yText = this.doc.getText("body");
      if (mode === "replace") {
        yText.delete(0, yText.length);
        yText.insert(0, proposal.suggestion);
      } else {
        const prefix = yText.length > 0 ? "\n\n" : "";
        yText.insert(yText.length, `${prefix}${proposal.suggestion}`);
      }
      const fields = this.doc.getMap("fields");
      fields.set("blake_last_commit", {
        opId,
        approver,
        at: Date.now(),
        path: proposal.path,
        model: proposal.model,
      });
      fields.delete("blake_pending");
    }, { actorId: "blake", actorKind: "ai" });

    this.pending.delete(opId);
    return { committed: true, opId };
  }

  private async callAnthropic(
    system: string,
    user: string,
    model: string
  ): Promise<string> {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.cfg.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Anthropic ${res.status}: ${errText.slice(0, 400)}`);
    }
    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = data.content
      ?.filter((c) => c.type === "text" && c.text)
      .map((c) => c.text)
      .join("\n")
      .trim();
    if (!text) throw new Error("Anthropic returned empty content");
    return text;
  }

  private async callOllama(
    system: string,
    user: string,
    model: string
  ): Promise<string> {
    const base = (this.cfg.ollamaUrl ?? "http://localhost:11434").replace(
      /\/$/,
      ""
    );
    const res = await fetch(`${base}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Ollama ${res.status}: ${errText.slice(0, 400)}`);
    }
    const data = (await res.json()) as {
      message?: { content?: string };
      response?: string;
    };
    const text = (data.message?.content ?? data.response ?? "").trim();
    if (!text) throw new Error("Ollama returned empty content");
    return text;
  }
}
