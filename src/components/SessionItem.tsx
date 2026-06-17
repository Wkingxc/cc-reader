import type { SessionInfo } from "../types/message";

interface Props {
  session: SessionInfo;
  isActive: boolean;
  isOpen: boolean;
  isFavorite?: boolean;
  onClick: () => void;
  onToggleFavorite?: () => void;
}

export default function SessionItem({
  session,
  isActive,
  isOpen,
  isFavorite,
  onClick,
  onToggleFavorite,
}: Props) {
  const stateClass = isActive
    ? "cc-session-sel bg-sel-bg text-sel-ink"
    : isOpen
      ? "text-ink bg-accent-soft hover:translate-x-0.5"
      : "text-dim hover:bg-accent-soft hover:text-ink hover:translate-x-0.5";

  return (
    <div className="relative group">
      <button
        onClick={onClick}
        className={`relative w-full text-left ${onToggleFavorite ? "pr-9" : "pr-3"} pl-3 py-2 rounded-md text-sm transition-all duration-200 ${stateClass}`}
      >
        <div className="truncate">{session.firstMessage || "(empty)"}</div>
        <div className="text-xs text-dim mt-0.5">
          {new Date(session.timestamp).toLocaleString()} · {session.messageCount} msgs
        </div>
      </button>
      {onToggleFavorite && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          className={`absolute right-1.5 top-1.5 px-1 py-0.5 rounded text-base leading-none transition-opacity ${
            isFavorite
              ? "text-yellow-500 opacity-100"
              : "text-dim opacity-0 group-hover:opacity-100 hover:text-yellow-500"
          }`}
          title={isFavorite ? "取消收藏" : "收藏"}
          aria-label={isFavorite ? "取消收藏" : "收藏"}
        >
          {isFavorite ? "★" : "☆"}
        </button>
      )}
    </div>
  );
}
