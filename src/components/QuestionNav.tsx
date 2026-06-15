import { useState } from "react";

interface QuestionEntry {
  index: number;
  text: string;
  uuid: string;
}

interface Props {
  questions: QuestionEntry[];
  onJump: (uuid: string) => void;
}

export default function QuestionNav({ questions, onJump }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  if (questions.length === 0) return null;

  return (
    <div className="fixed right-4 top-16 z-10">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="bg-gray-800 border border-gray-600 rounded-md px-2 py-1 text-xs text-gray-400 hover:text-gray-200 mb-1"
      >
        {collapsed ? "◀ Questions" : "▶ Hide"}
      </button>

      {!collapsed && (
        <div className="bg-gray-800/90 backdrop-blur-sm border border-gray-700 rounded-lg p-2 max-h-[70vh] overflow-y-auto w-56 shadow-xl">
          <div className="text-xs text-gray-500 px-2 py-1 mb-1">
            {questions.length} questions
          </div>
          {questions.map((q) => (
            <button
              key={q.uuid}
              onClick={() => onJump(q.uuid)}
              className="w-full text-left px-2 py-1.5 rounded text-xs text-gray-300 hover:bg-gray-700/50 hover:text-white transition-colors"
            >
              <span className="text-blue-400 font-mono mr-1">#{q.index}</span>
              <span className="truncate">{q.text || "(empty)"}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
