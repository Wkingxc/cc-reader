import type { CliId, Message } from "../types/message";
import { extractTextContent } from "../utils/parseContent";
import MarkdownContent from "./MarkdownContent";

interface Props {
  message: Message;
  questionIndex?: number;
  cli: CliId;
  project: string;
  sessionId: string;
}

export default function UserMessage({ message, questionIndex, cli, project, sessionId }: Props) {
  const text = extractTextContent(message.content);
  const images = message.images ?? [];
  if (!text.trim() && images.length === 0) return null;

  return (
    <div
      id={`msg-${message.uuid}`}
      className="cc-message-card cc-message-user border-l-4 rounded-r-xl p-4 my-3 transition-all"
      style={{ fontSize: "var(--font-size)" }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-bold text-white bg-accent px-2 py-0.5 rounded shadow-sm">
          You
        </span>
        {questionIndex !== undefined && (
          <span className="text-xs text-dim">#{questionIndex}</span>
        )}
        <span className="text-xs text-dim ml-auto">
          {new Date(message.timestamp).toLocaleTimeString()}
        </span>
      </div>
      {text.trim() && (
        <div className="prose max-w-none">
          <MarkdownContent content={text} />
        </div>
      )}
      {images.length > 0 && (
        <div className={`flex flex-wrap gap-2 ${text.trim() ? "mt-3" : ""}`}>
          {images.map((img) => {
            const url = `/api/image/${encodeURIComponent(project)}/${encodeURIComponent(sessionId)}/${encodeURIComponent(img.id)}?cli=${cli}`;
            return (
              <a
                key={img.id}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="block max-w-full rounded overflow-hidden border border-edge hover:border-accent transition-colors"
                title="点击查看原图"
              >
                <img
                  src={url}
                  alt="user pasted image"
                  loading="lazy"
                  className="max-w-full max-h-96 object-contain bg-base"
                />
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
