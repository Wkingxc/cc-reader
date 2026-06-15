import type { ContentBlock, Message } from "../types/message";

export function extractTextContent(content: string | ContentBlock[]): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  return content
    .filter((b): b is ContentBlock & { text: string } => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text)
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
  return messages
    .filter((m) => m.type === "user")
    .map((m, i) => ({
      index: i + 1,
      text: extractTextContent(m.content).slice(0, 40),
      uuid: m.uuid,
    }));
}
