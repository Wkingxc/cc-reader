import { useEffect, useRef } from "react";
import type { Message } from "../types/message";
import UserMessage from "./UserMessage";
import AssistantMessage from "./AssistantMessage";

interface Props {
  messages: Message[];
  userQuestionIndices: Map<string, number>;
}

export default function MessageList({ messages, userQuestionIndices }: Props) {
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
      <div className="flex-1 flex items-center justify-center text-gray-500">
        Select a session to view messages
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto p-4">
      {messages.map((msg) => {
        if (msg.type === "user") {
          return (
            <UserMessage
              key={msg.uuid}
              message={msg}
              questionIndex={userQuestionIndices.get(msg.uuid)}
            />
          );
        }
        return <AssistantMessage key={msg.uuid} message={msg} />;
      })}
      <div ref={bottomRef} />
    </div>
  );
}
