import { useState, useCallback, useMemo, useRef } from "react";
import type {
  CliId,
  Message,
  SessionInfo,
  SessionPage,
  TabData,
} from "./types/message";
import { getUserQuestions, extractTextContent } from "./utils/parseContent";
import { useFontSize } from "./hooks/useFontSize";
import { useTheme } from "./hooks/useTheme";
import { useCli } from "./hooks/useCli";
import { useFavorites } from "./hooks/useFavorites";
import { useShowTools } from "./hooks/useShowTools";
import { useReadingWidth } from "./hooks/useReadingWidth";
import { useWebSocket } from "./hooks/useWebSocket";
import { useScrollTo } from "./hooks/useScrollTo";
import Sidebar from "./components/Sidebar";
import Toolbar from "./components/Toolbar";
import TabBar from "./components/TabBar";
import MessageList from "./components/MessageList";
import QuestionNav from "./components/QuestionNav";

const ROUNDS_PER_PAGE = 10;

export default function App() {
  const [tabs, setTabs] = useState<TabData[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [questionNavCollapsed, setQuestionNavCollapsed] = useState(false);

  const { fontSize, increase, decrease } = useFontSize();
  const { theme, setTheme } = useTheme();
  const { cli, setCli } = useCli();
  const { favorites, isFavorite, toggle: toggleFavorite, remove: removeFavorite } =
    useFavorites(cli);
  const { showTools, toggle: toggleShowTools } = useShowTools();
  const { width: readingWidth, setWidth: setReadingWidth, maxWidth } =
    useReadingWidth();
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
        watch(existing.cli, existing.project, existing.id);
        return;
      }

      const res = await fetch(
        `/api/sessions/${project}/${session.id}?cli=${cli}&recentRounds=${ROUNDS_PER_PAGE}`
      );
      const data: SessionPage = await res.json();

      const newTab: TabData = {
        id: session.id,
        cli,
        project,
        session,
        messages: data.messages,
        totalRounds: data.totalRounds,
        oldestLoadedRound: data.oldestLoadedRound,
        hasMore: data.hasMore,
      };
      setTabs((prev) => [...prev, newTab]);
      setActiveTabId(session.id);

      unwatch();
      watch(cli, project, session.id);
    },
    [tabs, watch, unwatch, cli]
  );

  const handleLoadMore = useCallback(async () => {
    const tab = tabs.find((t) => t.id === activeTabIdRef.current);
    if (!tab || !tab.hasMore || tab.loadingMore) return;

    setTabs((prev) =>
      prev.map((t) => (t.id === tab.id ? { ...t, loadingMore: true } : t))
    );

    try {
      const res = await fetch(
        `/api/sessions/${tab.project}/${tab.id}?cli=${tab.cli}&beforeRound=${tab.oldestLoadedRound}&rounds=${ROUNDS_PER_PAGE}`
      );
      const data: SessionPage = await res.json();
      setTabs((prev) =>
        prev.map((t) =>
          t.id === tab.id
            ? {
                ...t,
                messages: [...data.messages, ...t.messages],
                oldestLoadedRound: data.oldestLoadedRound,
                hasMore: data.hasMore,
                totalRounds: data.totalRounds,
                loadingMore: false,
              }
            : t
        )
      );
    } catch {
      setTabs((prev) =>
        prev.map((t) => (t.id === tab.id ? { ...t, loadingMore: false } : t))
      );
    }
  }, [tabs]);

  const handleSelectTab = useCallback(
    (tabId: string) => {
      const tab = tabs.find((t) => t.id === tabId);
      if (!tab || tabId === activeTabId) return;

      setActiveTabId(tabId);
      unwatch();
      watch(tab.cli, tab.project, tab.id);
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
            watch(nextTab.cli, nextTab.project, nextTab.id);
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

  const handleSelectCli = useCallback(
    (next: CliId) => {
      if (next === cli) return;
      setCli(next);
      setTabs([]);
      setActiveTabId(null);
      unwatch();
    },
    [cli, setCli, unwatch]
  );

  const handleDeleteSession = useCallback(
    async (project: string, session: SessionInfo) => {
      // Optimistically close any open tab for this session and stop watching it.
      setTabs((prev) => {
        const remaining = prev.filter((t) => t.id !== session.id);
        if (activeTabIdRef.current === session.id) {
          unwatch();
          if (remaining.length > 0) {
            const closedIndex = prev.findIndex((t) => t.id === session.id);
            const newIndex = Math.min(closedIndex, remaining.length - 1);
            const nextTab = remaining[newIndex];
            setActiveTabId(nextTab.id);
            watch(nextTab.cli, nextTab.project, nextTab.id);
          } else {
            setActiveTabId(null);
          }
        }
        return remaining;
      });
      removeFavorite(project, session.id);

      try {
        await fetch(
          `/api/sessions/${project}/${session.id}?cli=${cli}`,
          { method: "DELETE" }
        );
      } catch {
        // best-effort: even if the server call fails, the UI is already cleaned up.
      }
    },
    [cli, watch, unwatch, removeFavorite]
  );

  const activeTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId) ?? null,
    [tabs, activeTabId]
  );
  const activeMessages = activeTab?.messages ?? [];
  const activeStartIndex = activeTab?.oldestLoadedRound ?? 1;

  const questions = useMemo(
    () => getUserQuestions(activeMessages, activeStartIndex),
    [activeMessages, activeStartIndex]
  );

  const userQuestionIndices = useMemo(() => {
    const map = new Map<string, number>();
    let idx = activeStartIndex - 1;
    for (const msg of activeMessages) {
      if (msg.type === "user") {
        const text = extractTextContent(msg.content).trim();
        if (!text) continue;
        idx++;
        map.set(msg.uuid, idx);
      }
    }
    return map;
  }, [activeMessages, activeStartIndex]);

  const openSessionIds = useMemo(
    () => new Set(tabs.map((t) => t.id)),
    [tabs]
  );

  const title = activeTab ? activeTab.session.firstMessage : "Select a session";

  return (
    <div className="cc-app-shell flex h-screen bg-base text-ink transition-colors">
      <Sidebar
        cli={cli}
        onSelectCli={handleSelectCli}
        onSelectSession={handleOpenTab}
        activeSessionId={activeTabId}
        openSessionIds={openSessionIds}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        favorites={favorites}
        isFavorite={isFavorite}
        onToggleFavorite={toggleFavorite}
        onDeleteSession={handleDeleteSession}
      />

      <div className="relative z-[1] flex-1 flex flex-col min-w-0">
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
          theme={theme}
          onSelectTheme={setTheme}
          showTools={showTools}
          onToggleTools={toggleShowTools}
          width={readingWidth}
          onSelectWidth={setReadingWidth}
        />

        <MessageList
          messages={activeMessages}
          userQuestionIndices={userQuestionIndices}
          cli={activeTab?.cli ?? cli}
          project={activeTab?.project ?? ""}
          sessionId={activeTab?.id ?? ""}
          showTools={showTools}
          maxWidth={maxWidth}
        />
      </div>

      <QuestionNav
        questions={questions}
        onJump={scrollTo}
        collapsed={questionNavCollapsed}
        onToggleCollapse={() => setQuestionNavCollapsed((c) => !c)}
        hasMore={activeTab?.hasMore ?? false}
        loadingMore={activeTab?.loadingMore ?? false}
        onLoadMore={handleLoadMore}
        totalRounds={activeTab?.totalRounds ?? questions.length}
      />
    </div>
  );
}
