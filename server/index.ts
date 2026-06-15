import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import * as path from "path";
import * as fs from "fs";
import * as net from "net";
import { exec } from "child_process";
import { fileURLToPath } from "url";
import projectsRouter from "./routes/projects.js";
import sessionsRouter from "./routes/sessions.js";
import { handleWatch, stopWatch, handleDisconnect } from "./watcher.js";
import { getClaudeDir } from "./parser.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = parseInt(process.env.PORT || "3456", 10);

app.use(express.json());

app.use("/api/projects", projectsRouter);
app.use("/api/sessions", sessionsRouter);

const distPath = path.join(__dirname, "..", "dist");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

const server = createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws: WebSocket) => {
  ws.on("message", (data: Buffer) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === "watch" && msg.project && msg.session) {
        handleWatch(ws, msg.project, msg.session);
      } else if (msg.type === "unwatch") {
        stopWatch(ws);
      }
    } catch {
      // ignore malformed messages
    }
  });

  ws.on("close", () => handleDisconnect(ws));
  ws.on("error", () => handleDisconnect(ws));
});

function findOpenPort(start: number): Promise<number> {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.listen(start, () => {
      s.close(() => resolve(start));
    });
    s.on("error", () => findOpenPort(start + 1).then(resolve));
  });
}

async function main() {
  const claudeDir = getClaudeDir();
  if (!fs.existsSync(claudeDir)) {
    console.error(`Error: ${claudeDir} not found. Is Claude Code installed?`);
    process.exit(1);
  }

  const port = await findOpenPort(PORT);
  server.listen(port, () => {
    const url = `http://localhost:${port}`;
    console.log(`CC Reader running at ${url}`);

    const platform = process.platform;
    const cmd =
      platform === "darwin" ? `open "${url}"` :
      platform === "win32" ? `start "${url}"` :
      `xdg-open "${url}"`;
    exec(cmd);
  });
}

main();
