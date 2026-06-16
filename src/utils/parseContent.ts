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

export function getToolSummary(block: { name?: string; input?: Record<string, unknown> }): string {
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

// 把 `$...$` / `$$...$$`（被反引号包裹的纯公式）解包成裸公式，让数学插件接管。
// 仅当反引号内整体就是一段 $...$ 公式时才解包，避免误伤普通行内代码。
// 注意：跳过 ``` 围栏代码块，避免破坏其中展示的 shell 代码（如 `cmd $A $B`）。
export function unwrapInlineMath(text: string): string {
  // 按 ``` 围栏切分：偶数索引是普通文本，奇数索引是围栏块（含```）。
  const parts = text.split(/(```[\s\S]*?```)/g);
  return parts
    .map((part, i) => {
      if (i % 2 === 1) return part; // 围栏块原样保留
      return part.replace(/`(\${1,2}[^`]*?\${1,2})`/g, (_m, formula) => formula);
    })
    .join("");
}
