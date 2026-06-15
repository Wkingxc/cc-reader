import chokidar from "chokidar";
import * as fs from "fs";
import * as path from "path";
import { WebSocket } from "ws";
import { parseNewLines, getProjectsDir } from "./parser.js";

interface WatchState {
  filePath: string;
  offset: number;
  watcher: chokidar.FSWatcher;
}

const clientWatches = new Map<WebSocket, WatchState>();

export function handleWatch(ws: WebSocket, project: string, session: string): void {
  stopWatch(ws);

  const filePath = path.join(getProjectsDir(), project, `${session}.jsonl`);

  if (!fs.existsSync(filePath)) return;

  const stat = fs.statSync(filePath);
  const offset = stat.size;

  const watcher = chokidar.watch(filePath, {
    persistent: true,
    usePolling: false,
    awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
  });

  const state: WatchState = { filePath, offset, watcher };
  clientWatches.set(ws, state);

  watcher.on("change", () => {
    const { messages, newOffset } = parseNewLines(state.filePath, state.offset);
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
