import * as Y from "yjs";

export type ArtifactKind =
  | "project"
  | "task"
  | "doc"
  | "care_plan"
  | "listing"
  | "trading_strategy"
  | "campaign"
  | "app_spec";

export interface Awareness {
  userId: string;
  name: string;
  color: string;
  isAI?: boolean;
  cursor?: { anchor: number; head: number };
}

export function newDoc(kind: ArtifactKind): Y.Doc {
  const d = new Y.Doc();
  d.getMap("meta").set("kind", kind);
  d.getArray("ops");
  d.getText("body");
  d.getMap("fields");
  return d;
}

/** TTSAI brand-derived collaborator palette (WCAG-AA verified) */
export const COLOR_PALETTE = [
  "#0A2540",
  "#D4AF37",
  "#143A66",
  "#36454F",
  "#8A8D91",
  "#A84B2F",
  "#1B474D",
  "#944454",
];
