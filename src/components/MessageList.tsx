import { useEffect, useRef } from "react";
import type { CliId, Message } from "../types/message";
import { extractTextContent } from "../utils/parseContent";
import UserMessage from "./UserMessage";
import AssistantMessage from "./AssistantMessage";

interface Props {
  messages: Message[];
  userQuestionIndices: Map<string, number>;
  cli: CliId;
  project: string;
  sessionId: string;
  showTools: boolean;
  maxWidth: string;
}

export default function MessageList({
  messages,
  userQuestionIndices,
  cli,
  project,
  sessionId,
  showTools,
  maxWidth,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const wasAtBottom = useRef(true);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      wasAtBottom.current = scrollHeight - scrollTop - clientHeight < 50;
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (wasAtBottom.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-dim">
        Select a session to view messages
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto p-4">
      <div
        className="mx-auto transition-[max-width] duration-200"
        style={{ maxWidth }}
      >
      {messages.map((msg) => {
        if (msg.type === "user") {
          return (
            <div key={msg.uuid} className="cc-msg-in">
              <UserMessage
                message={msg}
                questionIndex={userQuestionIndices.get(msg.uuid)}
                cli={cli}
                project={project}
                sessionId={sessionId}
              />
            </div>
          );
        }
        // When tool output is hidden, skip assistant turns that are purely
        // tool calls (no text). Mixed turns still render their narration.
        const text = extractTextContent(msg.content).trim();
        if (!showTools && !text && (msg.toolCalls?.length ?? 0) > 0) {
          return null;
        }
        return (
          <div key={msg.uuid} className="cc-msg-in">
            <AssistantMessage message={msg} showTools={showTools} />
          </div>
        );
      })}
      <div ref={bottomRef} />
      </div>
    </div>
  );
}
