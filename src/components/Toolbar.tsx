interface Props {
  title: string;
  fontSize: number;
  onIncrease: () => void;
  onDecrease: () => void;
  connected: boolean;
  isDark: boolean;
  onToggleTheme: () => void;
}

export default function Toolbar({
  title,
  fontSize,
  onIncrease,
  onDecrease,
  connected,
  isDark,
  onToggleTheme,
}: Props) {
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
        onClick={onToggleTheme}
        className="relative w-12 h-6 rounded-full bg-accent-soft border border-edge transition-colors shrink-0"
        title={isDark ? "Switch to light" : "Switch to dark"}
        aria-label={isDark ? "Switch to light" : "Switch to dark"}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-[18px] h-[18px] rounded-full bg-accent flex items-center justify-center text-[10px] transition-transform duration-300 ${
            isDark ? "translate-x-6 shadow-[0_0_8px_1px_var(--c-accent)]" : ""
          }`}
        >
          {isDark ? "🌙" : "☀"}
        </span>
      </button>

      <div
        className={`w-2 h-2 rounded-full ${connected ? "bg-green-400 cc-pulse" : "bg-red-400"}`}
        title={connected ? "Connected" : "Disconnected"}
      />
    </div>
  );
}
