import { claudeSource } from "./claude.js";
import { traeSource } from "./trae.js";
import type { CliSource } from "./types.js";

export type CliId = "claude" | "trae";

const sources: Record<CliId, CliSource> = {
  claude: claudeSource,
  trae: traeSource,
};

export function getSource(id: string | undefined): CliSource {
  if (id === "trae") return sources.trae;
  return sources.claude;
}

export function getAvailableCliIds(): CliId[] {
  return (Object.keys(sources) as CliId[]).filter((id) => sources[id].exists());
}

export type { CliSource } from "./types.js";
