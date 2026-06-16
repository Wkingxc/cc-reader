import { useState } from "react";
import type { ToolCall } from "../types/message";
import { getToolSummary } from "../utils/parseContent";

interface Props {
  tool: ToolCall;
}

export default function ToolCallBlock({ tool }: Props) {
  const [expanded, setExpanded] = useState(false);
  const summary = getToolSummary(tool);
  const hasResult = !!tool.result && tool.result.trim().length > 0;

  return (
    <div className="my-2 border border-dashed border-edge rounded-md overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-3 py-2 text-sm text-dim hover:text-accent flex items-center gap-2 font-mono transition-colors"
      >
        <span className="text-xs transition-transform duration-200" style={{ transform: expanded ? "rotate(90deg)" : "none" }}>▶</span>
        <span className={tool.isError ? "text-red-400" : "text-accent"}>⚡</span>
        <span className="truncate flex-1">{summary}</span>
        {hasResult && <span className="text-[10px] text-dim shrink-0">output</span>}
      </button>

      <div
        className="transition-all duration-300 ease-in-out overflow-hidden"
        style={{ maxHeight: expanded ? "600px" : "0px" }}
      >
        <div className="px-3 pb-3 text-sm space-y-2">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-dim mb-1">Input</div>
            <pre className="bg-base border border-edge rounded p-3 overflow-x-auto text-ink text-xs leading-relaxed max-h-60 overflow-y-auto">
              {JSON.stringify(tool.input, null, 2)}
            </pre>
          </div>
          {hasResult && (
            <div>
              <div className="text-[10px] uppercase tracking-wide text-dim mb-1">
                {tool.isError ? "Error output" : "Output"}
              </div>
              <pre className={`bg-base border rounded p-3 overflow-x-auto text-xs leading-relaxed max-h-60 overflow-y-auto ${tool.isError ? "border-red-400/40 text-red-300" : "border-edge text-ink"}`}>
                {tool.result}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
