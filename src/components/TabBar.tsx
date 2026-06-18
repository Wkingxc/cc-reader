import type { TabData } from "../types/message";

interface Props {
  tabs: TabData[];
  activeTabId: string | null;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
}

export default function TabBar({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
}: Props) {
  if (tabs.length === 0) return null;

  return (
    <div className="cc-tabbar flex items-center bg-side border-b border-edge overflow-x-auto shrink-0">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        const title = tab.session.firstMessage || "(empty session)";
        const truncated = title.length > 30 ? title.slice(0, 30) + "…" : title;

        return (
          <div
            key={tab.id}
            onClick={() => onSelectTab(tab.id)}
            onAuxClick={(e) => {
              if (e.button === 1) {
                e.preventDefault();
                onCloseTab(tab.id);
              }
            }}
            className={`cc-tab ${isActive ? "cc-tab-active" : ""} flex items-center gap-1.5 px-3 h-9 text-xs cursor-pointer select-none border-r border-edge shrink-0 max-w-[200px] transition-colors ${
              isActive
                ? "bg-base text-ink font-medium"
                : "bg-side text-dim hover:bg-accent-soft hover:text-ink"
            }`}
          >
            <span className="truncate flex-1">{truncated}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCloseTab(tab.id);
              }}
              className="w-4 h-4 flex items-center justify-center rounded hover:bg-accent-soft text-dim hover:text-ink shrink-0 text-[10px]"
              title="Close tab"
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
