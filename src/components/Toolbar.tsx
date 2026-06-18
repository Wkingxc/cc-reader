import { useState, useRef, useEffect } from "react";
import type { Theme } from "../hooks/useTheme";
import type { ReadingWidth } from "../hooks/useReadingWidth";

interface Props {
  title: string;
  fontSize: number;
  onIncrease: () => void;
  onDecrease: () => void;
  connected: boolean;
  theme: Theme;
  onSelectTheme: (theme: Theme) => void;
  showTools: boolean;
  onToggleTools: () => void;
  width: ReadingWidth;
  onSelectWidth: (w: ReadingWidth) => void;
}

// 面板内每个主题的展示信息。色块用固定色值，确保三个主题的色彩
// 始终可辨，不受当前激活主题的 CSS 变量影响。
const THEME_OPTIONS: {
  id: Theme;
  label: string;
  icon: string;
  base: string;
  accent: string;
}[] = [
  { id: "light", label: "浅紫", icon: "☀", base: "#ffffff", accent: "#6366f1" },
  { id: "blue", label: "浅蓝", icon: "☀", base: "#ffffff", accent: "#0ea5e9" },
  { id: "dark", label: "暗色", icon: "🌙", base: "#0f1117", accent: "#22d3ee" },
];

// 阅读区宽度预设。fillFraction 仅用作面板里那个迷你示意条的可视宽度，
// 真正的最大宽度逻辑在 useReadingWidth 里。
const WIDTH_OPTIONS: {
  id: ReadingWidth;
  label: string;
  hint: string;
  fillFraction: number;
}[] = [
  { id: "narrow", label: "窄", hint: "720px", fillFraction: 0.45 },
  { id: "normal", label: "适中", hint: "896px", fillFraction: 0.62 },
  { id: "wide", label: "宽", hint: "1200px", fillFraction: 0.82 },
  { id: "full", label: "全宽", hint: "铺满", fillFraction: 1 },
];

export default function Toolbar({
  title,
  fontSize,
  onIncrease,
  onDecrease,
  connected,
  theme,
  onSelectTheme,
  showTools,
  onToggleTools,
  width,
  onSelectWidth,
}: Props) {
  const [open, setOpen] = useState(false);
  const [widthOpen, setWidthOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const widthWrapRef = useRef<HTMLDivElement>(null);

  // 点击面板外部或按 Esc 关闭
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!widthOpen) return;
    const onPointer = (e: MouseEvent) => {
      if (widthWrapRef.current && !widthWrapRef.current.contains(e.target as Node)) {
        setWidthOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setWidthOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [widthOpen]);

  const current = THEME_OPTIONS.find((t) => t.id === theme) ?? THEME_OPTIONS[0];
  const currentWidth = WIDTH_OPTIONS.find((w) => w.id === width) ?? WIDTH_OPTIONS[1];

  return (
    <div className="h-12 bg-side border-b border-edge px-4 flex items-center gap-3 shrink-0 transition-colors">
      <h2 className="text-sm font-medium text-ink truncate flex-1">
        {title || "CC Reader"}
      </h2>

      <div className="flex items-center gap-1">
        <button
          onClick={onDecrease}
          className="px-2 py-1 text-sm bg-accent-soft text-ink rounded transition-all hover:-translate-y-0.5"
          title="Decrease font size (Ctrl+-)"
        >
          A−
        </button>
        <span className="text-xs text-dim w-10 text-center">{fontSize}px</span>
        <button
          onClick={onIncrease}
          className="px-2 py-1 text-sm bg-accent-soft text-ink rounded transition-all hover:-translate-y-0.5"
          title="Increase font size (Ctrl+=)"
        >
          A+
        </button>
      </div>

      <button
        onClick={onToggleTools}
        className={`h-7 px-2.5 flex items-center gap-1.5 rounded-full border border-edge text-xs transition-all hover:-translate-y-0.5 ${
          showTools
            ? "bg-accent-soft text-ink"
            : "bg-base text-dim"
        }`}
        title={showTools ? "隐藏工具调用输出" : "显示工具调用输出"}
        aria-label={showTools ? "隐藏工具调用输出" : "显示工具调用输出"}
        aria-pressed={showTools}
      >
        {showTools ? (
          // eye — output is visible
          <svg
            viewBox="0 0 24 24"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        ) : (
          // eye-off — output is muted
          <svg
            viewBox="0 0 24 24"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M17.94 17.94A10.5 10.5 0 0112 19c-6.5 0-10-7-10-7a18.6 18.6 0 014.06-4.94" />
            <path d="M9.9 4.24A10.4 10.4 0 0112 4c6.5 0 10 7 10 7a18.5 18.5 0 01-3.17 4.21" />
            <path d="M9.88 9.88a3 3 0 104.24 4.24" />
            <path d="M3 3l18 18" />
          </svg>
        )}
        <span className="font-medium whitespace-nowrap">
          工具输出{showTools ? "" : "已隐藏"}
        </span>
      </button>

      <div ref={widthWrapRef} className="relative shrink-0">
        <button
          onClick={() => setWidthOpen((v) => !v)}
          className="h-7 px-2.5 flex items-center gap-1.5 rounded-full bg-accent-soft border border-edge text-xs text-ink transition-all hover:-translate-y-0.5"
          title="阅读宽度"
          aria-label="阅读宽度"
          aria-haspopup="menu"
          aria-expanded={widthOpen}
        >
          {/* horizontal-arrows: 左右箭头表示宽度 */}
          <svg
            viewBox="0 0 24 24"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M21 12H3" />
            <path d="M7 8l-4 4 4 4" />
            <path d="M17 8l4 4-4 4" />
          </svg>
          <span className="font-medium whitespace-nowrap">{currentWidth.label}</span>
          <span
            className={`text-dim transition-transform duration-200 ${widthOpen ? "rotate-180" : ""}`}
          >
            ▾
          </span>
        </button>

        {widthOpen && (
          <div
            role="menu"
            className="cc-pop-in absolute right-0 top-full mt-1.5 w-44 p-1 rounded-lg bg-surface border border-edge shadow-lg shadow-black/10 z-20"
          >
            {WIDTH_OPTIONS.map((opt) => {
              const active = opt.id === width;
              return (
                <button
                  key={opt.id}
                  role="menuitemradio"
                  aria-checked={active}
                  onClick={() => {
                    onSelectWidth(opt.id);
                    setWidthOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-xs transition-colors ${
                    active
                      ? "bg-sel-bg text-sel-ink font-medium"
                      : "text-ink hover:bg-accent-soft"
                  }`}
                >
                  {/* 迷你示意条：背景代表整个视口宽度，前景代表当前预设的占比 */}
                  <span className="w-7 h-3.5 rounded-sm bg-base border border-edge relative shrink-0 overflow-hidden">
                    <span
                      className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 bg-accent rounded-sm"
                      style={{ width: `${opt.fillFraction * 100}%` }}
                    />
                  </span>
                  <span className="flex-1 text-left">{opt.label}</span>
                  <span className="text-[10px] text-dim shrink-0">{opt.hint}</span>
                  {active && <span className="text-sel-ink">✓</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div ref={wrapRef} className="relative shrink-0">
        <button
          onClick={() => setOpen((v) => !v)}
          className="h-7 pl-1.5 pr-2.5 rounded-full bg-accent-soft border border-edge flex items-center gap-1.5 text-xs text-ink transition-all hover:-translate-y-0.5"
          title="切换主题"
          aria-label="切换主题"
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <span
            className="w-4 h-4 rounded-full border border-edge shrink-0"
            style={{
              background: `linear-gradient(135deg, ${current.base} 0 50%, ${current.accent} 50% 100%)`,
            }}
          />
          <span className="font-medium">{current.label}</span>
          <span
            className={`text-dim transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          >
            ▾
          </span>
        </button>

        {open && (
          <div
            role="menu"
            className="cc-pop-in absolute right-0 top-full mt-1.5 w-40 p-1 rounded-lg bg-surface border border-edge shadow-lg shadow-black/10 z-20"
          >
            {THEME_OPTIONS.map((opt) => {
              const active = opt.id === theme;
              return (
                <button
                  key={opt.id}
                  role="menuitemradio"
                  aria-checked={active}
                  onClick={() => {
                    onSelectTheme(opt.id);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-xs transition-colors ${
                    active
                      ? "bg-sel-bg text-sel-ink font-medium"
                      : "text-ink hover:bg-accent-soft"
                  }`}
                >
                  <span
                    className="w-5 h-5 rounded-full border border-edge shrink-0"
                    style={{
                      background: `linear-gradient(135deg, ${opt.base} 0 50%, ${opt.accent} 50% 100%)`,
                    }}
                  />
                  <span className="flex-1 text-left">{opt.label}</span>
                  {active && <span className="text-sel-ink">✓</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div
        className={`w-2 h-2 rounded-full ${connected ? "bg-green-400 cc-pulse" : "bg-red-400"}`}
        title={connected ? "Connected" : "Disconnected"}
      />
    </div>
  );
}
