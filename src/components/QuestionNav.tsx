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
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  totalRounds: number;
}

export default function QuestionNav({
  questions,
  onJump,
  collapsed,
  onToggleCollapse,
  hasMore,
  loadingMore,
  onLoadMore,
  totalRounds,
}: Props) {
  const [search, setSearch] = useState("");

  useEffect(() => {
    setSearch("");
  }, [questions]);

  if (questions.length === 0 && !hasMore) return null;

  if (collapsed) {
    return (
      <div className="cc-question-nav w-12 flex-shrink-0 bg-side border-l border-edge flex flex-col items-center pt-3">
        <button
          onClick={onToggleCollapse}
          className="text-dim hover:text-accent hover:bg-accent-soft text-sm p-1.5 rounded transition-colors"
          title="Show questions"
        >
          «
        </button>
        <div className="mt-2 text-xs font-medium text-accent bg-accent-soft px-1.5 py-0.5 rounded">
          {totalRounds || questions.length}
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
    <div className="cc-question-nav w-72 flex-shrink-0 bg-side border-l border-edge flex flex-col h-full overflow-hidden">
      <div className="cc-question-header flex items-center justify-between px-3 py-2 border-b border-edge">
        <span className="text-xs font-medium text-dim">
          Questions ({totalRounds || questions.length})
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
            className="cc-search w-full px-2 py-1 text-xs bg-base border border-edge rounded-lg text-ink placeholder-dim focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {hasMore && !search && (
          <button
            onClick={onLoadMore}
            disabled={loadingMore}
            className="w-full text-left px-3 py-2 text-xs text-dim hover:text-accent hover:bg-accent-soft transition-colors border-b border-edge disabled:opacity-50 disabled:cursor-wait flex items-center gap-1.5"
            title="加载更早的 10 轮提问"
          >
            <span className="text-accent">↑</span>
            <span className="flex-1">
              {loadingMore ? "加载中…" : `加载更早的 10 轮（还有 ${questions[0]?.index ? questions[0].index - 1 : 0} 轮）`}
            </span>
          </button>
        )}

        {filtered.map((q) => (
          <button
            key={q.uuid}
            onClick={() => onJump(q.uuid)}
            className="cc-question-item w-full text-left px-3 py-2.5 text-sm text-ink hover:bg-accent-soft transition-colors border-b border-edge group"
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
