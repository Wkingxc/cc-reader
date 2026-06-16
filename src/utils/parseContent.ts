import type { ContentBlock, Message } from "../types/message";

function stripSystemTags(text: string): string {
  return text
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "")
    .replace(/<local-command-caveat>[\s\S]*?<\/local-command-caveat>/g, "")
    .replace(/<local-command-stdout>[\s\S]*?<\/local-command-stdout>/g, "")
    .replace(/<command-name>[\s\S]*?<\/command-name>/g, "")
    .replace(/<command-message>[\s\S]*?<\/command-message>/g, "")
    .replace(/<command-args>[\s\S]*?<\/command-args>/g, "")
    .replace(/<bridge_context>[\s\S]*?<\/bridge_context>/g, "")
    .trim();
}

export function extractTextContent(content: string | ContentBlock[]): string {
  if (typeof content === "string") return stripSystemTags(content);
  if (!Array.isArray(content)) return "";

  return content
    .filter((b): b is ContentBlock & { text: string } => b.type === "text" && typeof b.text === "string")
    .map((b) => stripSystemTags(b.text))
    .filter(Boolean)
    .join("\n\n");
}

export function extractToolCalls(content: string | ContentBlock[]): ContentBlock[] {
  if (typeof content === "string" || !Array.isArray(content)) return [];
  return content.filter((b) => b.type === "tool_use");
}

export function getToolSummary(block: ContentBlock): string {
  const name = block.name || "Unknown";
  const input = block.input || {};

  switch (name) {
    case "Read":
      return `Read: ${input.file_path || ""}`;
    case "Bash":
      return `Bash: ${String(input.command || "").slice(0, 60)}`;
    case "Edit":
      return `Edit: ${input.file_path || ""}`;
    case "Write":
      return `Write: ${input.file_path || ""}`;
    case "Agent":
      return `Agent: ${String(input.description || input.prompt || "").slice(0, 50)}`;
    case "WebSearch":
      return `WebSearch: ${input.query || ""}`;
    default:
      return name;
  }
}

export function getUserQuestions(messages: Message[]): Array<{ index: number; text: string; uuid: string }> {
  const results: Array<{ index: number; text: string; uuid: string }> = [];
  let idx = 0;
  for (const m of messages) {
    if (m.type !== "user") continue;
    const text = extractTextContent(m.content).trim();
    if (!text) continue;
    idx++;
    results.push({ index: idx, text: text.slice(0, 40), uuid: m.uuid });
  }
  return results;
}
