import { useState } from "react";
import MarkdownContent from "./MarkdownContent";

interface Props {
  // assistant 一轮里除最后一段收尾总结外的「中间旁白」各段（每段 = 一个 ● 白点）。
  segments: string[];
}

// 把一轮 assistant 回复里的中间旁白合并成「一个整体折叠块」（不是每段单独折叠），
// 默认收起，点击展开。交互范式与 ToolCallBlock 一致：▶ 旋转 + 平滑展开动画。
export default function CollapsedNarration({ segments }: Props) {
  const [expanded, setExpanded] = useState(false);
  if (segments.length === 0) return null;

  return (
    <div className="my-2 border border-dashed border-edge rounded-md overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-3 py-2 text-sm text-dim hover:text-accent flex items-center gap-2 transition-colors"
      >
        <span
          className="text-xs transition-transform duration-200"
          style={{ transform: expanded ? "rotate(90deg)" : "none" }}
        >
          ▶
        </span>
        <span className="truncate flex-1">
          {expanded ? "收起中间思考" : `展开 ${segments.length} 段中间思考`}
        </span>
      </button>

      {/* 用 grid 行高 0fr→1fr 过渡：任意高度都能平滑展开且不截断中间旁白。
          ToolCallBlock 用固定 max-height 是因为其输出内部另有滚动容器，
          这里的旁白是连续 markdown，不宜截断，故改用 grid 方案。 */}
      <div
        className="grid"
        style={{
          gridTemplateRows: expanded ? "1fr" : "0fr",
          transition: "grid-template-rows 300ms ease-in-out",
        }}
      >
        <div className="overflow-hidden">
          <div className="px-3 pb-3 space-y-3">
            {segments.map((seg, i) => (
              <div key={i} className={i > 0 ? "border-t border-dashed border-edge pt-3" : ""}>
                <div className="prose max-w-none">
                  <MarkdownContent content={seg} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
