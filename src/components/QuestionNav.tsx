import { useState, useEffect } from "react";

interface QuestionEntry {
  index: number;
  text: string;
  uuid: string;
}

interface Props {
  questions: QuestionEntry[];
  onJump: (uuid: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export default function QuestionNav({
  questions,
  onJump,
  collapsed,
  onToggleCollapse,
}: Props) {
  const [search, setSearch] = useState("");

  useEffect(() => {
    setSearch("");
  }, [questions]);

  if (questions.length === 0) return null;

  if (collapsed) {
    return (
      <div className="w-12 flex-shrink-0 bg-gray-50 border-l border-gray-200 flex flex-col items-center pt-3">
        <button
          onClick={onToggleCollapse}
          className="text-gray-500 hover:text-blue-600 hover:bg-gray-200 text-sm p-1.5 rounded transition-colors"
          title="Show questions"
        >
          «
        </button>
        <div className="mt-2 text-xs font-medium text-blue-500 bg-blue-100 px-1.5 py-0.5 rounded">
          {questions.length}
        </div>
      </div>
    );
  }

  const filtered = search
    ? questions.filter(
        (q) =>
          q.text.toLowerCase().includes(search.toLowerCase()) ||
          String(q.index).includes(search)
      )
    : questions;

  return (
    <div className="w-72 flex-shrink-0 bg-gray-50 border-l border-gray-200 flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
        <span className="text-xs font-medium text-gray-500">
          Questions ({questions.length})
        </span>
        <button
          onClick={onToggleCollapse}
          className="text-gray-400 hover:text-gray-600 text-sm"
          title="Hide questions"
        >
          »
        </button>
      </div>

      {questions.length > 10 && (
        <div className="px-2 py-1.5 border-b border-gray-200">
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-2 py-1 text-xs bg-white border border-gray-300 rounded text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {filtered.map((q) => (
          <button
            key={q.uuid}
            onClick={() => onJump(q.uuid)}
            className="w-full text-left px-3 py-2.5 text-sm text-gray-600 hover:bg-blue-50 hover:text-gray-900 transition-colors border-b border-gray-100 group"
          >
            <span className="text-blue-600 font-mono mr-1.5 text-xs font-medium group-hover:text-blue-700">
              #{q.index}
            </span>
            <span className="text-gray-700 group-hover:text-gray-900">{q.text || "(empty)"}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
