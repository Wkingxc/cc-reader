import type { SessionInfo } from "../types/message";

interface Props {
  session: SessionInfo;
  isActive: boolean;
  isOpen: boolean;
  onClick: () => void;
}

export default function SessionItem({ session, isActive, isOpen, onClick }: Props) {
  const stateClass = isActive
    ? "cc-session-sel bg-sel-bg text-sel-ink"
    : isOpen
      ? "text-ink bg-accent-soft hover:translate-x-0.5"
      : "text-dim hover:bg-accent-soft hover:text-ink hover:translate-x-0.5";

  return (
    <button
      onClick={onClick}
      className={`relative w-full text-left px-3 py-2 rounded-md text-sm transition-all duration-200 ${stateClass}`}
    >
      <div className="truncate">{session.firstMessage || "(empty)"}</div>
      <div className="text-xs text-dim mt-0.5">
        {new Date(session.timestamp).toLocaleString()} · {session.messageCount} msgs
      </div>
    </button>
  );
}
