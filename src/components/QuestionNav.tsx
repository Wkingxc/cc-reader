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
      <div className="w-12 flex-shrink-0 bg-side border-l border-edge flex flex-col items-center pt-3">
        <button
          onClick={onToggleCollapse}
          className="text-dim hover:text-accent hover:bg-accent-soft text-sm p-1.5 rounded transition-colors"
          title="Show questions"
        >
          «
        </button>
        <div className="mt-2 text-xs font-medium text-accent bg-accent-soft px-1.5 py-0.5 rounded">
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
    <div className="w-72 flex-shrink-0 bg-side border-l border-edge flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-edge">
        <span className="text-xs font-medium text-dim">
          Questions ({questions.length})
        </span>
        <button
          onClick={onToggleCollapse}
          className="text-dim hover:text-ink text-sm"
          title="Hide questions"
        >
          »
        </button>
      </div>

      {questions.length > 10 && (
        <div className="px-2 py-1.5 border-b border-edge">
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-2 py-1 text-xs bg-base border border-edge rounded text-ink placeholder-dim focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {filtered.map((q) => (
          <button
            key={q.uuid}
            onClick={() => onJump(q.uuid)}
            className="w-full text-left px-3 py-2.5 text-sm text-ink hover:bg-accent-soft transition-colors border-b border-edge group"
          >
            <span className="text-accent font-mono mr-1.5 text-xs font-medium group-hover:text-accent">
              #{q.index}
            </span>
            <span className="text-ink">{q.text || "(empty)"}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
