import { useLayoutEffect, useRef, useState } from "react";
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

const COLLAPSED_LINES = 10;

export default function UserMessage({ message, questionIndex, cli, project, sessionId }: Props) {
  const text = extractTextContent(message.content);
  const images = message.images ?? [];
  const contentRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [canCollapse, setCanCollapse] = useState(false);
  const [collapsedMaxHeight, setCollapsedMaxHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el || !text.trim()) {
      setCanCollapse(false);
      setCollapsedMaxHeight(null);
      setExpanded(false);
      return;
    }

    const compute = () => {
      const style = window.getComputedStyle(el);
      const fontSize = parseFloat(style.fontSize) || 16;
      const lineHeight =
        style.lineHeight === "normal"
          ? fontSize * 1.7
          : parseFloat(style.lineHeight) || fontSize * 1.7;
      const maxHeight = Math.ceil(lineHeight * COLLAPSED_LINES);
      const shouldCollapse = el.scrollHeight > maxHeight + lineHeight * 0.5;
      setCollapsedMaxHeight(maxHeight);
      setCanCollapse(shouldCollapse);
      if (!shouldCollapse) setExpanded(false);
    };

    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [message.uuid, text]);

  if (!text.trim() && images.length === 0) return null;

  const showCollapsed = canCollapse && !expanded;

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
        <div className="relative">
          <div
            ref={contentRef}
            className="prose max-w-none overflow-hidden transition-[max-height] duration-200"
            style={
              showCollapsed && collapsedMaxHeight !== null
                ? { maxHeight: collapsedMaxHeight }
                : undefined
            }
          >
            <MarkdownContent content={text} />
          </div>
          {showCollapsed && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-b from-transparent to-[var(--c-user-bg)]" />
          )}
          {canCollapse && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-2 text-xs font-medium text-accent hover:underline"
              aria-expanded={expanded}
            >
              {expanded ? "收起" : `展开全部（超过 ${COLLAPSED_LINES} 行）`}
            </button>
          )}
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
