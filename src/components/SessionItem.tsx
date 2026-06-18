import { useEffect, useRef, useState } from "react";
import type { SessionInfo } from "../types/message";

interface Props {
  session: SessionInfo;
  isActive: boolean;
  isOpen: boolean;
  isFavorite?: boolean;
  onClick: () => void;
  onToggleFavorite?: () => void;
  onDelete?: () => void;
}

// Solid star — used when the session is favorited.
function StarSolidIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M12 2.5l2.95 5.97 6.6.96-4.78 4.66 1.13 6.57L12 17.77 6.1 20.66l1.13-6.57L2.45 9.43l6.6-.96L12 2.5z" />
    </svg>
  );
}

// Outline star — used when the session is not yet favorited.
function StarOutlineIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 2.5l2.95 5.97 6.6.96-4.78 4.66 1.13 6.57L12 17.77 6.1 20.66l1.13-6.57L2.45 9.43l6.6-.96L12 2.5z" />
    </svg>
  );
}

function TrashIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

export default function SessionItem({
  session,
  isActive,
  isOpen,
  isFavorite,
  onClick,
  onToggleFavorite,
  onDelete,
}: Props) {
  const [confirming, setConfirming] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Cancel inline confirm on Escape or outside click.
  useEffect(() => {
    if (!confirming) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setConfirming(false);
    };
    const onPointer = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setConfirming(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [confirming]);

  const stateClass = isActive
    ? "cc-session-card cc-session-sel text-sel-ink"
    : isOpen
      ? "cc-session-card text-ink bg-accent-soft hover:translate-x-0.5"
      : "cc-session-card text-dim hover:bg-accent-soft hover:text-ink hover:translate-x-0.5";

  // Right-padding budget for the title row. The two trailing controls stack
  // vertically (delete on top, favorite below) so a single column is enough.
  const trailingPad =
    onToggleFavorite || onDelete ? "pr-9" : "pr-3";

  return (
    <div ref={rootRef} className="relative group">
      <button
        onClick={onClick}
        className={`relative w-full text-left ${trailingPad} pl-3 py-2 text-sm transition-all duration-200 ${stateClass}`}
      >
        <div className="truncate">{session.firstMessage || "(empty)"}</div>
        <div className="text-xs text-dim mt-0.5">
          {new Date(session.timestamp).toLocaleString()} · {session.messageCount} msgs
        </div>
      </button>

      {confirming && onDelete ? (
        // Slide-in confirmation pill, anchored to the row's right edge so it
        // visually replaces the trailing icons.
        <div
          className="cc-confirm-in absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1 px-1 py-1 rounded-md bg-surface border border-edge shadow-md shadow-black/10 z-10"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setConfirming(false);
              onDelete();
            }}
            className="px-2 py-0.5 rounded text-xs font-medium leading-none text-white bg-red-500 hover:bg-red-600 transition-colors"
            title="确认删除"
            aria-label="确认删除"
          >
            删除
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setConfirming(false);
            }}
            className="px-1.5 py-0.5 rounded text-xs leading-none text-dim hover:bg-accent-soft hover:text-ink transition-colors"
            title="取消"
            aria-label="取消删除"
          >
            取消
          </button>
        </div>
      ) : (
        <>
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setConfirming(true);
              }}
              className="absolute right-1 top-1 p-1 rounded text-dim opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-500/10 transition-opacity"
              title="删除会话"
              aria-label="删除会话"
            >
              <TrashIcon />
            </button>
          )}
          {onToggleFavorite && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite();
              }}
              className={`absolute right-1 bottom-1 p-1 rounded transition-opacity ${
                isFavorite
                  ? "text-yellow-500 opacity-100"
                  : "text-dim opacity-0 group-hover:opacity-100 hover:text-yellow-500"
              }`}
              title={isFavorite ? "取消收藏" : "收藏"}
              aria-label={isFavorite ? "取消收藏" : "收藏"}
            >
              {isFavorite ? <StarSolidIcon /> : <StarOutlineIcon />}
            </button>
          )}
        </>
      )}
    </div>
  );
}
