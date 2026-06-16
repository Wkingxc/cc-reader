import { useState } from "react";
import type { ToolCall } from "../types/message";
import { getToolSummary } from "../utils/parseContent";

interface Props {
  tool: ToolCall;
}

export default function ToolCallBlock({ tool }: Props) {
  const [expanded, setExpanded] = useState(false);
  const summary = getToolSummary(tool);

  return (
    <div className="my-2 border border-dashed border-edge rounded-md">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-3 py-2 text-sm text-dim hover:text-accent flex items-center gap-2 font-mono transition-colors"
      >
        <span className="text-xs">{expanded ? "▼" : "▶"}</span>
        <span className="text-accent">⚡</span>
        <span className="truncate flex-1">{summary}</span>
      </button>
      {expanded && (
        <div className="px-3 pb-3 text-sm">
          <pre className="bg-base border border-edge rounded p-3 overflow-x-auto text-ink text-xs leading-relaxed">
            {JSON.stringify(tool.input, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
