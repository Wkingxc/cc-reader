import type { Message } from "../types/message";
import { extractTextContent } from "../utils/parseContent";
import MarkdownContent from "./MarkdownContent";

interface Props {
  message: Message;
  questionIndex?: number;
}

export default function UserMessage({ message, questionIndex }: Props) {
  const text = extractTextContent(message.content);
  if (!text.trim()) return null;

  return (
    <div
      id={`msg-${message.uuid}`}
      className="border-l-4 border-blue-500 bg-gray-800/50 rounded-r-lg p-4 my-3 transition-all"
      style={{ fontSize: "var(--font-size)" }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-bold text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded">
          You
        </span>
        {questionIndex !== undefined && (
          <span className="text-xs text-gray-500">#{questionIndex}</span>
        )}
        <span className="text-xs text-gray-500 ml-auto">
          {new Date(message.timestamp).toLocaleTimeString()}
        </span>
      </div>
      <div className="prose prose-invert max-w-none">
        <MarkdownContent content={text} />
      </div>
    </div>
  );
}
