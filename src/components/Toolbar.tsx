import { useState, useRef, useEffect } from "react";
import type { Theme } from "../hooks/useTheme";

interface Props {
  title: string;
  fontSize: number;
  onIncrease: () => void;
  onDecrease: () => void;
  connected: boolean;
  theme: Theme;
  onSelectTheme: (theme: Theme) => void;
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

export default function Toolbar({
  title,
  fontSize,
  onIncrease,
  onDecrease,
  connected,
  theme,
  onSelectTheme,
}: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

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

  const current = THEME_OPTIONS.find((t) => t.id === theme) ?? THEME_OPTIONS[0];

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
