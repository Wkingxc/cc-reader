import { useState, useCallback, useMemo } from "react";
import type { Message, SessionInfo } from "./types/message";
import { getUserQuestions } from "./utils/parseContent";
import { useFontSize } from "./hooks/useFontSize";
import { useWebSocket } from "./hooks/useWebSocket";
import { useScrollTo } from "./hooks/useScrollTo";
import Sidebar from "./components/Sidebar";
import Toolbar from "./components/Toolbar";
import MessageList from "./components/MessageList";
import QuestionNav from "./components/QuestionNav";

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeSession, setActiveSession] = useState<{
    project: string;
    session: SessionInfo;
  } | null>(null);

  const { fontSize, increase, decrease } = useFontSize();
  const { scrollTo } = useScrollTo();

  const handleNewMessages = useCallback((newMsgs: Message[]) => {
    setMessages((prev) => [...prev, ...newMsgs]);
  }, []);

  const { connected, watch, unwatch } = useWebSocket(handleNewMessages);

  const handleSelectSession = useCallback(
    async (project: string, session: SessionInfo) => {
      unwatch();
      setActiveSession({ project, session });

      const res = await fetch(`/api/sessions/${project}/${session.id}`);
      const data = await res.json();
      setMessages(data);

      watch(project, session.id);
    },
    [watch, unwatch]
  );

  const questions = useMemo(() => getUserQuestions(messages), [messages]);

  const userQuestionIndices = useMemo(() => {
    const map = new Map<string, number>();
    let idx = 0;
    for (const msg of messages) {
      if (msg.type === "user") {
        idx++;
        map.set(msg.uuid, idx);
      }
    }
    return map;
  }, [messages]);

  const title = activeSession
    ? activeSession.session.firstMessage
    : "Select a session";

  return (
    <div className="flex h-screen bg-gray-900 text-gray-100">
      <Sidebar
        onSelectSession={handleSelectSession}
        activeSessionId={activeSession?.session.id ?? null}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Toolbar
          title={title}
          fontSize={fontSize}
          onIncrease={increase}
          onDecrease={decrease}
          connected={connected}
        />

        <MessageList
          messages={messages}
          userQuestionIndices={userQuestionIndices}
        />

        <QuestionNav questions={questions} onJump={scrollTo} />
      </div>
    </div>
  );
}
