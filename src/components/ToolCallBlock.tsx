import { useState } from "react";
import type { ContentBlock } from "../types/message";
import { getToolSummary } from "../utils/parseContent";

interface Props {
  block: ContentBlock;
}

export default function ToolCallBlock({ block }: Props) {
  const [expanded, setExpanded] = useState(false);
  const summary = getToolSummary(block);

  return (
    <div className="my-2 border border-dashed border-gray-300 rounded-md">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:text-gray-700 flex items-center gap-2 font-mono"
      >
        <span className="text-xs">{expanded ? "▼" : "▶"}</span>
        <span className="text-gray-400">⚡</span>
        <span className="truncate">{summary}</span>
      </button>
      {expanded && (
        <div className="px-3 pb-3 text-sm">
          <pre className="bg-gray-100 rounded p-3 overflow-x-auto text-gray-700 text-xs leading-relaxed">
            {JSON.stringify(block.input, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
