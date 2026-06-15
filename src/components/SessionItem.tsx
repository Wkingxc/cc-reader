import type { SessionInfo } from "../types/message";

interface Props {
  session: SessionInfo;
  isActive: boolean;
  onClick: () => void;
}

export default function SessionItem({ session, isActive, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
        isActive
          ? "bg-blue-600/20 text-blue-300 border border-blue-500/30"
          : "text-gray-400 hover:bg-gray-700/50 hover:text-gray-200"
      }`}
    >
      <div className="truncate">{session.firstMessage || "(empty)"}</div>
      <div className="text-xs text-gray-500 mt-0.5">
        {new Date(session.timestamp).toLocaleString()} · {session.messageCount} msgs
      </div>
    </button>
  );
}
