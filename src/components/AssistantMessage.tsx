import type { Message } from "../types/message";
import { extractTextContent } from "../utils/parseContent";
import CollapsedNarration from "./CollapsedNarration";
import MarkdownContent from "./MarkdownContent";
import ToolCallBlock from "./ToolCallBlock";

interface Props {
  message: Message;
  showTools?: boolean;
}

export default function AssistantMessage({ message, showTools = true }: Props) {
  const text = extractTextContent(message.content);
  const toolCalls = message.toolCalls ?? [];

  // segments：一轮回复里被工具调用打断的各段白点文字（后端提供）。
  // n>=2 时把前 n-1 段折叠为「中间思考」，只把最后一段当收尾总结正常渲染。
  // 无 segments（旧数据/纯对话）时回落到用 content 整体渲染。
  const segments = (message.segments ?? []).filter((s) => s.trim());
  const hasNarration = segments.length >= 2;
  const intro = hasNarration ? segments.slice(0, -1) : [];
  const finalText = hasNarration ? segments[segments.length - 1] : text;

  if (!text.trim() && toolCalls.length === 0) return null;
  // When tool output is hidden and this assistant turn is purely a tool call
  // (no narration), drop the entire bubble — caller filters it in too, but
  // returning null here keeps the component safe to render directly.
  if (!showTools && !text.trim()) return null;

  return (
    <div
      id={`msg-${message.uuid}`}
      className="cc-message-card cc-message-assistant bg-surface border border-edge rounded-xl p-4 my-3 transition-all"
      style={{ fontSize: "var(--font-size)" }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-bold text-accent bg-accent-soft px-2 py-0.5 rounded">
          Claude
        </span>
        {message.model && <span className="text-xs text-dim">{message.model}</span>}
        <span className="text-xs text-dim ml-auto">
          {new Date(message.timestamp).toLocaleTimeString()}
        </span>
      </div>

      {hasNarration && <CollapsedNarration segments={intro} />}

      {finalText.trim() && (
        <div className="prose max-w-none">
          <MarkdownContent content={finalText} />
        </div>
      )}

      {showTools &&
        toolCalls.map((tc, i) => <ToolCallBlock key={tc.id || i} tool={tc} />)}
    </div>
  );
}
