import * as Y from "yjs";

export interface BlakeConfig {
  apiKey: string; // ANTHROPIC_API_KEY
  model: string; // "claude-sonnet-4"
  scopes: ("read" | "suggest" | "edit" | "deploy")[];
  tenantId: string;
  hipaaMode: boolean; // if true, route through local Ollama only
}

export class BlakeAgent {
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

  async propose(prompt: string): Promise<{ accepted: boolean; opId: string }> {
    const opId = globalThis.crypto.randomUUID();
    // TODO: route to Anthropic OR Ollama based on hipaaMode
    void prompt;
    void this.doc;
    void this.cfg;
    return { accepted: false, opId };
  }

  async commitIfAuthorized(opId: string, approver: string) {
    if (!this.cfg.scopes.includes("edit")) {
      throw new Error("scope:edit required");
    }
    // TODO: apply pending op after human approval
    void opId;
    void approver;
  }
}
