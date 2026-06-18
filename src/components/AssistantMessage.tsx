import type { Message } from "../types/message";
import { extractTextContent } from "../utils/parseContent";
import MarkdownContent from "./MarkdownContent";
import ToolCallBlock from "./ToolCallBlock";

interface Props {
  message: Message;
  showTools?: boolean;
}

export default function AssistantMessage({ message, showTools = true }: Props) {
  const text = extractTextContent(message.content);
  const toolCalls = message.toolCalls ?? [];

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

      {text.trim() && (
        <div className="prose max-w-none">
          <MarkdownContent content={text} />
        </div>
      )}

      {showTools &&
        toolCalls.map((tc, i) => <ToolCallBlock key={tc.id || i} tool={tc} />)}
    </div>
  );
}
