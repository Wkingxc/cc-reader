export interface ImageRef {
  id: string;
  mediaType: string;
}

export interface ParsedMessage {
  uuid: string;
  type: "user" | "assistant";
  timestamp: string;
  content: string | Array<Record<string, unknown>>;
  // assistant 一轮回复里被工具调用打断的各段文字（终端里的每个 ● 白点），
  // 按时间顺序保留。前端用它把「中间旁白」折叠、只展示最后一段收尾总结。
  // content 仍为全部段拼接，向后兼容搜索/标题等逻辑。
  segments?: string[];
  // Claude Code 在 /rename、/resume、/clear 等纯本地命令后会写入一条
  // model:"<synthetic>" 的合成 assistant 条目（"No response requested."、
  // "API Error: ..." 等）。它不是模型对上一条用户消息的回复，因此既不能与
  // 相邻真实回复合并（否则污染其 segments），渲染上也要单独处理。
  synthetic?: boolean;
  toolCalls?: Array<{
    id: string;
    name: string;
    input: Record<string, unknown>;
    result?: string;
    isError?: boolean;
  }>;
  model?: string;
  images?: ImageRef[];
}

export function stripSystemTags(text: string): string {
  return text
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "")
    .replace(/<local-command-caveat>[\s\S]*?<\/local-command-caveat>/g, "")
    .replace(/<local-command-stdout>[\s\S]*?<\/local-command-stdout>/g, "")
    .replace(/<command-name>[\s\S]*?<\/command-name>/g, "")
    .replace(/<command-message>[\s\S]*?<\/command-message>/g, "")
    .replace(/<command-args>[\s\S]*?<\/command-args>/g, "")
    .replace(/<bridge_context>[\s\S]*?<\/bridge_context>/g, "")
    .replace(/<permissions instructions>[\s\S]*?<\/permissions instructions>/g, "")
    .replace(/<plugins_instructions>[\s\S]*?<\/plugins_instructions>/g, "")
    .replace(/<skills_instructions>[\s\S]*?<\/skills_instructions>/g, "")
    .trim();
}

export function extractText(content: string | Array<Record<string, unknown>>): string {
  let raw: string;
  if (typeof content === "string") {
    raw = content;
  } else if (Array.isArray(content)) {
    raw = content
      .filter((b) => (b.type === "text" || b.type === "input_text" || b.type === "output_text") && typeof b.text === "string")
      .map((b) => b.text as string)
      .join("\n\n");
  } else {
    return "";
  }
  return stripSystemTags(raw);
}

export function mergeMessages(raw: ParsedMessage[]): ParsedMessage[] {
  const merged: ParsedMessage[] = [];

  for (const msg of raw) {
    const prev = merged[merged.length - 1];
    // synthetic 占位条目自成一条，绝不与前后真实回复合并：否则它会被当成
    // 同一轮的新一段白点 push 进 segments，把真实收尾挤进折叠区。
    if (prev && prev.type === msg.type && !prev.synthetic && !msg.synthetic) {
      const prevText = extractText(prev.content);
      const curText = extractText(msg.content);
      const combined = [prevText, curText].filter(Boolean).join("\n\n");
      prev.content = combined;
      prev.timestamp = msg.timestamp || prev.timestamp;
      if (msg.images?.length) {
        prev.images = [...(prev.images ?? []), ...msg.images];
      }
      if (msg.type === "assistant") {
        prev.model = msg.model || prev.model;
        // 把这次合并进来的文字作为新的一段（白点）保留下来。
        if (curText.trim()) prev.segments!.push(curText);
        if (msg.toolCalls?.length) {
          prev.toolCalls = [...(prev.toolCalls ?? []), ...msg.toolCalls];
        }
      }
    } else {
      const text = extractText(msg.content);
      const next: ParsedMessage = { ...msg, content: text };
      if (msg.type === "assistant") {
        next.segments = text.trim() ? [text] : [];
      }
      merged.push(next);
    }
  }

  return merged.filter((m) => {
    const text = typeof m.content === "string" ? m.content.trim() : "";
    return (
      text.length > 0 ||
      (m.toolCalls?.length ?? 0) > 0 ||
      (m.images?.length ?? 0) > 0
    );
  });
}
