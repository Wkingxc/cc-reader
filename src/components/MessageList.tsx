import { useLayoutEffect, useMemo, useRef } from "react";
import type { CliId, Message } from "../types/message";
import { extractTextContent } from "../utils/parseContent";
import UserMessage from "./UserMessage";
import AssistantMessage from "./AssistantMessage";

interface Props {
  messages: Message[];
  startIndex: number;
  cli: CliId;
  project: string;
  sessionId: string;
  showTools: boolean;
  maxWidth: string;
  active: boolean;
}

export default function MessageList({
  messages,
  startIndex,
  cli,
  project,
  sessionId,
  showTools,
  maxWidth,
  active,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const didInitialScroll = useRef(false);
  // active 的最新值，供异步落底回调读取（隐藏时 scrollHeight 为 0，不能落底）。
  const activeRef = useRef(active);
  activeRef.current = active;

  // 每个标签一个常驻 MessageList，App 用 active 控制显隐。切标签只是显隐，
  // 浏览器原生保留各自的 scrollTop，无需手动记忆/恢复滚动位置。

  // 首次激活且有内容时落到底部看最新消息；此后不再自动滚动（含新消息到来）。
  // 代码高亮、公式等异步渲染会改变高度，用几帧 rAF 在落底窗口内持续贴底。
  useLayoutEffect(() => {
    if (didInitialScroll.current || !active) return;
    const container = containerRef.current;
    if (!container || messages.length === 0) return;

    const toBottom = () => {
      if (!activeRef.current) return;
      container.scrollTop = container.scrollHeight;
    };
    toBottom();
    didInitialScroll.current = true;

    let frame = 0;
    let count = 0;
    const tick = () => {
      toBottom();
      if (++count < 6) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [messages.length, active]);

  const userQuestionIndices = useMemo(() => {
    const map = new Map<string, number>();
    let idx = startIndex - 1;
    for (const msg of messages) {
      if (msg.type === "user") {
        const text = extractTextContent(msg.content).trim();
        if (!text) continue;
        idx++;
        map.set(msg.uuid, idx);
      }
    }
    return map;
  }, [messages, startIndex]);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto p-4"
      style={{ display: active ? undefined : "none" }}
    >
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
          // 隐藏工具输出时，跳过纯工具调用（无正文）的 assistant 轮次。
          // 含正文的混合轮次仍然渲染它的叙述部分。
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
      </div>
    </div>
  );
}
