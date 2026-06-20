import { claudeSource } from "./claude.js";
import { traeSource } from "./trae.js";
import { codexSource } from "./codex.js";
import type { CliSource } from "./types.js";

export type CliId = "claude" | "trae" | "codex";

const sources: Record<CliId, CliSource> = {
  claude: claudeSource,
  trae: traeSource,
  codex: codexSource,
};

export function getSource(id: string | undefined): CliSource {
  if (id === "trae") return sources.trae;
  if (id === "codex") return sources.codex;
  return sources.claude;
}

export function getAvailableCliIds(): CliId[] {
  return (Object.keys(sources) as CliId[]).filter((id) => sources[id].exists());
}

export type { CliSource } from "./types.js";
