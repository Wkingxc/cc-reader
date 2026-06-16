import type { SessionInfo } from "../types/message";

interface Props {
  session: SessionInfo;
  isActive: boolean;
  isOpen: boolean;
  onClick: () => void;
}

export default function SessionItem({ session, isActive, isOpen, onClick }: Props) {
  const className = isActive
    ? "bg-blue-100 text-blue-700 border border-blue-300"
    : isOpen
      ? "bg-gray-200/40 text-gray-700 border-l-2 border-l-blue-300"
      : "text-gray-600 hover:bg-gray-200/60 hover:text-gray-800";

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${className}`}
    >
      <div className="truncate">{session.firstMessage || "(empty)"}</div>
      <div className="text-xs text-gray-400 mt-0.5">
        {new Date(session.timestamp).toLocaleString()} · {session.messageCount} msgs
      </div>
    </button>
  );
}
