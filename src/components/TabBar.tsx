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
    <div className="flex items-center bg-gray-100 border-b border-gray-200 overflow-x-auto shrink-0">
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
            className={`flex items-center gap-1.5 px-3 h-9 text-xs cursor-pointer select-none border-r border-gray-200 shrink-0 max-w-[200px] transition-colors ${
              isActive
                ? "bg-white text-gray-900 border-b-2 border-b-blue-500 font-medium"
                : "bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            }`}
          >
            <span className="truncate flex-1">{truncated}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCloseTab(tab.id);
              }}
              className="w-4 h-4 flex items-center justify-center rounded hover:bg-gray-300/60 text-gray-400 hover:text-gray-700 shrink-0 text-[10px]"
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
