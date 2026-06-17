import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  ParsedMessage,
  extractText,
  mergeMessages,
  stripSystemTags,
} from "../parser.js";
import type { CliSource, ProjectInfo, SessionListItem } from "./types.js";

interface TraeRolloutLine {
  timestamp?: string;
  type?: string;
  payload?: Record<string, unknown>;
}

interface SessionSummary {
  id: string;
  filePath: string;
  cwd: string;
  startedAt: string;
  mtime: string;
}

function getTraeSessionsDir(): string {
  return path.join(os.homedir(), ".trae", "cli", "sessions");
}

function encodeCwdAsDirName(cwd: string): string {
  return cwd.replace(/\//g, "-");
}

function decodeDirNameToCwd(dirName: string): string {
  if (!dirName) return "";
  const replaced = dirName.replace(/-/g, "/");
  return replaced.startsWith("/") ? replaced : "/" + replaced;
}

function projectDisplayName(cwd: string): string {
  const home = os.homedir();
  const parts = home.split(path.sep);
  const user = parts[parts.length - 1];
  const homePrefix = `/Users/${user}/`;
  if (cwd.startsWith(homePrefix)) return cwd.slice(homePrefix.length);
  return cwd.replace(/^\//, "");
}

function parseLine(line: string): TraeRolloutLine | null {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

function readSessionMeta(filePath: string): {
  id: string;
  cwd: string;
  startedAt: string;
} | null {
  try {
    const fd = fs.openSync(filePath, "r");
    const buf = Buffer.alloc(8192);
    const n = fs.readSync(fd, buf, 0, buf.length, 0);
    fs.closeSync(fd);
    const text = buf.slice(0, n).toString("utf-8");
    const firstNewline = text.indexOf("\n");
    const firstLine = firstNewline >= 0 ? text.slice(0, firstNewline) : text;
    const obj = parseLine(firstLine);
    if (!obj || obj.type !== "session_meta") return null;
    const p = obj.payload as Record<string, unknown> | undefined;
    if (!p) return null;
    const id = String(p.id || "");
    const cwd = String(p.cwd || "");
    const startedAt = String(p.timestamp || obj.timestamp || "");
    if (!id || !cwd) return null;
    return { id, cwd, startedAt };
  } catch {
    return null;
  }
}

function listAllRolloutFiles(): string[] {
  const root = getTraeSessionsDir();
  if (!fs.existsSync(root)) return [];

  const out: string[] = [];
  const stack: string[] = [root];
  while (stack.length) {
    const dir = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        // Skip *.artifacts side directories that pair with a rollout file.
        if (e.name.endsWith(".artifacts")) continue;
        stack.push(full);
      } else if (e.isFile() && e.name.startsWith("rollout-") && e.name.endsWith(".jsonl")) {
        out.push(full);
      }
    }
  }
  return out;
}

let cache: {
  scannedAt: number;
  byId: Map<string, SessionSummary>;
  byProject: Map<string, SessionSummary[]>;
  projectsList: ProjectInfo[];
} | null = null;

const CACHE_TTL_MS = 5_000;

function refreshIndex(force = false): void {
  const now = Date.now();
  if (!force && cache && now - cache.scannedAt < CACHE_TTL_MS) return;

  const files = listAllRolloutFiles();
  const byId = new Map<string, SessionSummary>();
  const byProject = new Map<string, SessionSummary[]>();
  const projectAccum = new Map<string, ProjectInfo>();

  for (const filePath of files) {
    const meta = readSessionMeta(filePath);
    if (!meta) continue;
    let stat: fs.Stats;
    try {
      stat = fs.statSync(filePath);
    } catch {
      continue;
    }
    const summary: SessionSummary = {
      id: meta.id,
      filePath,
      cwd: meta.cwd,
      startedAt: meta.startedAt,
      mtime: stat.mtime.toISOString(),
    };
    byId.set(meta.id, summary);

    const dirName = encodeCwdAsDirName(meta.cwd);
    if (!byProject.has(dirName)) byProject.set(dirName, []);
    byProject.get(dirName)!.push(summary);

    if (!projectAccum.has(dirName)) {
      projectAccum.set(dirName, {
        name: projectDisplayName(meta.cwd),
        dirName,
        path: meta.cwd,
        sessionCount: 0,
      });
    }
    projectAccum.get(dirName)!.sessionCount += 1;
  }

  for (const list of byProject.values()) {
    list.sort((a, b) => b.mtime.localeCompare(a.mtime));
  }

  const projectsList = Array.from(projectAccum.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  cache = { scannedAt: now, byId, byProject, projectsList };
}

function buildToolMap(
  lines: TraeRolloutLine[]
): Map<string, { text: string; isError: boolean }> {
  const outputs = new Map<string, { text: string; isError: boolean }>();
  for (const ln of lines) {
    if (ln.type !== "response_item") continue;
    const p = ln.payload || {};
    if (p.type === "function_call_output" && typeof p.call_id === "string") {
      const text = typeof p.output === "string" ? p.output : JSON.stringify(p.output ?? "");
      outputs.set(p.call_id as string, { text, isError: false });
    }
  }
  return outputs;
}

function lineToMessage(
  ln: TraeRolloutLine,
  index: number,
  outputs: Map<string, { text: string; isError: boolean }>
): ParsedMessage | null {
  if (ln.type !== "response_item") return null;
  const p = ln.payload || {};
  const ts = ln.timestamp || "";

  if (p.type === "message") {
    const role = p.role as string | undefined;
    if (role !== "user" && role !== "assistant") return null;

    const blocks = (p.content as Array<Record<string, unknown>> | undefined) ?? [];
    const textBlocks = blocks.filter(
      (b) =>
        (b.type === "input_text" || b.type === "output_text" || b.type === "text") &&
        typeof b.text === "string"
    );
    if (textBlocks.length === 0) return null;

    const filtered =
      role === "user"
        ? textBlocks.filter((b) => !isSyntheticUserText(b.text as string))
        : textBlocks;
    if (filtered.length === 0) return null;

    const normalized = filtered.map((b) => ({ type: "text", text: b.text }));
    return {
      uuid: `trae-msg-${index}`,
      type: role,
      timestamp: ts,
      content: normalized,
    };
  }

  if (p.type === "function_call") {
    const callId = String(p.call_id || `trae-call-${index}`);
    const name = String(p.name || "");
    let input: Record<string, unknown> = {};
    if (typeof p.arguments === "string") {
      try {
        input = JSON.parse(p.arguments);
      } catch {
        input = { _raw: p.arguments };
      }
    } else if (p.arguments && typeof p.arguments === "object") {
      input = p.arguments as Record<string, unknown>;
    }
    const result = outputs.get(callId);
    return {
      uuid: `trae-call-${index}`,
      type: "assistant",
      timestamp: ts,
      content: "",
      toolCalls: [
        {
          id: callId,
          name,
          input,
          result: result?.text,
          isError: result?.isError,
        },
      ],
    };
  }

  return null;
}

function parseRolloutFile(filePath: string): ParsedMessage[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n").filter((l) => l.trim());
  const parsed: TraeRolloutLine[] = [];
  for (const line of lines) {
    const obj = parseLine(line);
    if (obj) parsed.push(obj);
  }
  const outputs = buildToolMap(parsed);
  const raw: ParsedMessage[] = [];
  parsed.forEach((ln, i) => {
    const msg = lineToMessage(ln, i, outputs);
    if (msg) raw.push(msg);
  });
  return mergeMessages(raw);
}

function isSyntheticUserText(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (/^Today's date is /.test(trimmed)) return true;
  if (trimmed.startsWith("<")) return true;
  return false;
}

function parseFirstUserText(filePath: string): string {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n").filter((l) => l.trim());
  for (const line of lines) {
    const obj = parseLine(line);
    if (!obj || obj.type !== "response_item") continue;
    const p = obj.payload || {};
    if (p.type !== "message" || p.role !== "user") continue;
    const blocks = (p.content as Array<Record<string, unknown>> | undefined) ?? [];
    for (const b of blocks) {
      if (typeof b.text === "string") {
        const cleaned = stripSystemTags(b.text);
        if (cleaned && !isSyntheticUserText(cleaned)) return cleaned.slice(0, 80);
      }
    }
  }
  return "(empty session)";
}

function summaryToListItem(s: SessionSummary): SessionListItem {
  let firstMessage = "(empty)";
  let messageCount = 0;
  try {
    firstMessage = parseFirstUserText(s.filePath);
    const content = fs.readFileSync(s.filePath, "utf-8");
    messageCount = content.split("\n").filter((l) => l.trim()).length;
  } catch {
    // skip
  }
  return {
    id: s.id,
    firstMessage,
    timestamp: s.mtime,
    messageCount,
    project: encodeCwdAsDirName(s.cwd),
  };
}

export const traeSource: CliSource = {
  id: "trae",

  exists() {
    return fs.existsSync(getTraeSessionsDir());
  },

  listProjects(): ProjectInfo[] {
    refreshIndex(true);
    return cache!.projectsList.slice();
  },

  listSessions(projectDirName: string): SessionListItem[] {
    refreshIndex();
    const list = cache!.byProject.get(projectDirName) ?? [];
    return list.map(summaryToListItem);
  },

  recentSessions(limit: number): SessionListItem[] {
    refreshIndex(true);
    const all = Array.from(cache!.byId.values()).sort((a, b) =>
      b.mtime.localeCompare(a.mtime)
    );
    return all.slice(0, limit).map(summaryToListItem);
  },

  searchSessions(query: string): SessionListItem[] {
    refreshIndex();
    const q = query.toLowerCase();
    const results: SessionListItem[] = [];
    for (const s of cache!.byId.values()) {
      const projectName = projectDisplayName(s.cwd).toLowerCase();
      const item = summaryToListItem(s);
      if (
        projectName.includes(q) ||
        item.firstMessage.toLowerCase().includes(q)
      ) {
        results.push(item);
      }
    }
    results.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return results;
  },

  resolveSessionFile(_projectDirName: string, sessionId: string): string | null {
    refreshIndex();
    const s = cache!.byId.get(sessionId);
    return s ? s.filePath : null;
  },

  parseSession(projectDirName: string, sessionId: string): ParsedMessage[] | null {
    const filePath = this.resolveSessionFile(projectDirName, sessionId);
    if (!filePath) return null;
    return parseRolloutFile(filePath);
  },

  parseNewBytes(filePath: string, fromByte: number) {
    const stat = fs.statSync(filePath);
    if (stat.size <= fromByte) return { messages: [], newOffset: fromByte };

    const fd = fs.openSync(filePath, "r");
    const buf = Buffer.alloc(stat.size - fromByte);
    fs.readSync(fd, buf, 0, buf.length, fromByte);
    fs.closeSync(fd);

    const text = buf.toString("utf-8");
    const lines = text.split("\n").filter((l) => l.trim());
    const parsed: TraeRolloutLine[] = [];
    for (const line of lines) {
      const obj = parseLine(line);
      if (obj) parsed.push(obj);
    }
    const outputs = buildToolMap(parsed);
    const messages: ParsedMessage[] = [];
    parsed.forEach((ln, i) => {
      const msg = lineToMessage(ln, i, outputs);
      if (msg) messages.push(msg);
    });
    return { messages, newOffset: stat.size };
  },
};

export { encodeCwdAsDirName, decodeDirNameToCwd, projectDisplayName, extractText };
