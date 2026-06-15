interface Props {
  title: string;
  fontSize: number;
  onIncrease: () => void;
  onDecrease: () => void;
  connected: boolean;
}

export default function Toolbar({ title, fontSize, onIncrease, onDecrease, connected }: Props) {
  return (
    <div className="h-12 bg-gray-800 border-b border-gray-700 px-4 flex items-center gap-3 shrink-0">
      <h2 className="text-sm font-medium text-gray-200 truncate flex-1">
        {title || "CC Reader"}
      </h2>

      <div className="flex items-center gap-1">
        <button
          onClick={onDecrease}
          className="px-2 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded transition-colors"
          title="Decrease font size (Ctrl+-)"
        >
          A−
        </button>
        <span className="text-xs text-gray-400 w-10 text-center">{fontSize}px</span>
        <button
          onClick={onIncrease}
          className="px-2 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded transition-colors"
          title="Increase font size (Ctrl+=)"
        >
          A+
        </button>
      </div>

      <div
        className={`w-2 h-2 rounded-full ${connected ? "bg-green-400" : "bg-red-400"}`}
        title={connected ? "Connected" : "Disconnected"}
      />
    </div>
  );
}
