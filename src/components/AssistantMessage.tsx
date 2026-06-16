import type { Message } from "../types/message";
import { extractTextContent } from "../utils/parseContent";
import MarkdownContent from "./MarkdownContent";

interface Props {
  message: Message;
}

export default function AssistantMessage({ message }: Props) {
  const text = extractTextContent(message.content);

  if (!text.trim()) return null;

  return (
    <div
      id={`msg-${message.uuid}`}
      className="rounded-lg p-4 my-3 transition-all"
      style={{ fontSize: "var(--font-size)" }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-bold text-purple-600 bg-purple-100 px-2 py-0.5 rounded">
          Claude
        </span>
        {message.model && (
          <span className="text-xs text-gray-400">{message.model}</span>
        )}
        <span className="text-xs text-gray-400 ml-auto">
          {new Date(message.timestamp).toLocaleTimeString()}
        </span>
      </div>

      <div className="prose max-w-none">
        <MarkdownContent content={text} />
      </div>
    </div>
  );
}
