import { useState, useCallback, useMemo, useRef } from "react";
import type { Message, SessionInfo, TabData } from "./types/message";
import { getUserQuestions, extractTextContent } from "./utils/parseContent";
import { useFontSize } from "./hooks/useFontSize";
import { useWebSocket } from "./hooks/useWebSocket";
import { useScrollTo } from "./hooks/useScrollTo";
import Sidebar from "./components/Sidebar";
import Toolbar from "./components/Toolbar";
import TabBar from "./components/TabBar";
import MessageList from "./components/MessageList";
import QuestionNav from "./components/QuestionNav";

export default function App() {
  const [tabs, setTabs] = useState<TabData[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [questionNavCollapsed, setQuestionNavCollapsed] = useState(false);

  const { fontSize, increase, decrease } = useFontSize();
  const { scrollTo } = useScrollTo();

  const activeTabIdRef = useRef(activeTabId);
  activeTabIdRef.current = activeTabId;

  const handleNewMessages = useCallback((newMsgs: Message[]) => {
    const currentTabId = activeTabIdRef.current;
    if (!currentTabId) return;

    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === currentTabId
          ? { ...tab, messages: [...tab.messages, ...newMsgs] }
          : tab
      )
    );
  }, []);

  const { connected, watch, unwatch } = useWebSocket(handleNewMessages);

  const handleOpenTab = useCallback(
    async (project: string, session: SessionInfo) => {
      const existing = tabs.find((t) => t.id === session.id);
      if (existing) {
        setActiveTabId(session.id);
        unwatch();
        watch(project, session.id);
        return;
      }

      const res = await fetch(`/api/sessions/${project}/${session.id}`);
      const data: Message[] = await res.json();

      const newTab: TabData = { id: session.id, project, session, messages: data };
      setTabs((prev) => [...prev, newTab]);
      setActiveTabId(session.id);

      unwatch();
      watch(project, session.id);
    },
    [tabs, watch, unwatch]
  );

  const handleSelectTab = useCallback(
    (tabId: string) => {
      const tab = tabs.find((t) => t.id === tabId);
      if (!tab || tabId === activeTabId) return;

      setActiveTabId(tabId);
      unwatch();
      watch(tab.project, tab.id);
    },
    [tabs, activeTabId, watch, unwatch]
  );

  const handleCloseTab = useCallback(
    (tabId: string) => {
      setTabs((prev) => {
        const remaining = prev.filter((t) => t.id !== tabId);

        if (activeTabId === tabId) {
          if (remaining.length > 0) {
            const closedIndex = prev.findIndex((t) => t.id === tabId);
            const newIndex = Math.min(closedIndex, remaining.length - 1);
            const nextTab = remaining[newIndex];
            setActiveTabId(nextTab.id);
            unwatch();
            watch(nextTab.project, nextTab.id);
          } else {
            setActiveTabId(null);
            unwatch();
          }
        }

        return remaining;
      });
    },
    [activeTabId, watch, unwatch]
  );

  const activeTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId) ?? null,
    [tabs, activeTabId]
  );
  const activeMessages = activeTab?.messages ?? [];

  const questions = useMemo(
    () => getUserQuestions(activeMessages),
    [activeMessages]
  );

  const userQuestionIndices = useMemo(() => {
    const map = new Map<string, number>();
    let idx = 0;
    for (const msg of activeMessages) {
      if (msg.type === "user") {
        const text = extractTextContent(msg.content).trim();
        if (!text) continue;
        idx++;
        map.set(msg.uuid, idx);
      }
    }
    return map;
  }, [activeMessages]);

  const openSessionIds = useMemo(
    () => new Set(tabs.map((t) => t.id)),
    [tabs]
  );

  const title = activeTab ? activeTab.session.firstMessage : "Select a session";

  return (
    <div className="flex h-screen bg-white text-gray-900">
      <Sidebar
        onSelectSession={handleOpenTab}
        activeSessionId={activeTabId}
        openSessionIds={openSessionIds}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <TabBar
          tabs={tabs}
          activeTabId={activeTabId}
          onSelectTab={handleSelectTab}
          onCloseTab={handleCloseTab}
        />

        <Toolbar
          title={title}
          fontSize={fontSize}
          onIncrease={increase}
          onDecrease={decrease}
          connected={connected}
        />

        <MessageList
          messages={activeMessages}
          userQuestionIndices={userQuestionIndices}
        />
      </div>

      <QuestionNav
        questions={questions}
        onJump={scrollTo}
        collapsed={questionNavCollapsed}
        onToggleCollapse={() => setQuestionNavCollapsed((c) => !c)}
      />
    </div>
  );
}
