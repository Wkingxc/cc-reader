import type { Message } from "../types/message";
import { extractTextContent } from "../utils/parseContent";
import MarkdownContent from "./MarkdownContent";
import ToolCallBlock from "./ToolCallBlock";

interface Props {
  message: Message;
}

export default function AssistantMessage({ message }: Props) {
  const text = extractTextContent(message.content);
  const toolCalls = message.toolCalls ?? [];

  if (!text.trim() && toolCalls.length === 0) return null;

  return (
    <div
      id={`msg-${message.uuid}`}
      className="bg-surface border border-edge rounded-lg p-4 my-3 transition-all"
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

      {toolCalls.map((tc, i) => (
        <ToolCallBlock key={tc.id || i} tool={tc} />
      ))}
    </div>
  );
}
