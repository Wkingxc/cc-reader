import chokidar from "chokidar";
import * as fs from "fs";
import { WebSocket } from "ws";
import { getSource } from "./sources/index.js";

interface WatchState {
  filePath: string;
  offset: number;
  watcher: chokidar.FSWatcher;
  cli: string;
}

const clientWatches = new Map<WebSocket, WatchState>();

export function handleWatch(
  ws: WebSocket,
  cli: string,
  project: string,
  session: string
): void {
  stopWatch(ws);

  const source = getSource(cli);
  const filePath = source.resolveSessionFile(project, session);
  if (!filePath || !fs.existsSync(filePath)) return;

  const stat = fs.statSync(filePath);
  const offset = stat.size;

  const watcher = chokidar.watch(filePath, {
    persistent: true,
    usePolling: false,
    awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
  });

  const state: WatchState = { filePath, offset, watcher, cli };
  clientWatches.set(ws, state);

  watcher.on("change", () => {
    const { messages, newOffset } = getSource(state.cli).parseNewBytes(
      state.filePath,
      state.offset
    );
    state.offset = newOffset;

    if (messages.length > 0 && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "new-messages", messages }));
    }
  });
}

export function stopWatch(ws: WebSocket): void {
  const state = clientWatches.get(ws);
  if (state) {
    state.watcher.close();
    clientWatches.delete(ws);
  }
}

export function handleDisconnect(ws: WebSocket): void {
  stopWatch(ws);
}
