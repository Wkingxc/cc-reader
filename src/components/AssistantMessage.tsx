import type { Message } from "../types/message";
import { extractTextContent, extractToolCalls } from "../utils/parseContent";
import MarkdownContent from "./MarkdownContent";
import ToolCallBlock from "./ToolCallBlock";

interface Props {
  message: Message;
}

export default function AssistantMessage({ message }: Props) {
  const text = extractTextContent(message.content);
  const toolCalls = extractToolCalls(message.content);

  if (!text.trim() && toolCalls.length === 0) return null;

  return (
    <div
      id={`msg-${message.uuid}`}
      className="rounded-lg p-4 my-3 transition-all"
      style={{ fontSize: "var(--font-size)" }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-bold text-purple-400 bg-purple-400/10 px-2 py-0.5 rounded">
          Claude
        </span>
        {message.model && (
          <span className="text-xs text-gray-600">{message.model}</span>
        )}
        <span className="text-xs text-gray-500 ml-auto">
          {new Date(message.timestamp).toLocaleTimeString()}
        </span>
      </div>

      {toolCalls.map((tc, i) => (
        <ToolCallBlock key={tc.id || `${tc.name}-${i}`} block={tc} />
      ))}

      {text.trim() && (
        <div className="prose prose-invert max-w-none">
          <MarkdownContent content={text} />
        </div>
      )}
    </div>
  );
}
