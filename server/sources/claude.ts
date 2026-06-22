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

interface RawJsonlEntry {
  uuid?: string;
  parentUuid?: string;
  type?: string;
  timestamp?: string;
  sessionId?: string;
  message?: {
    role?: string;
    content?: string | Array<Record<string, unknown>>;
    model?: string;
  };
  isSidechain?: boolean;
  isMeta?: boolean;
}

function getProjectsDir(): string {
  return path.join(os.homedir(), ".claude", "projects");
}

function parseProjectName(dirName: string): string {
  const home = os.homedir();
  const parts = home.split(path.sep);
  const user = parts[parts.length - 1];
  const prefix = `-Users-${user}-`;
  const name = dirName.startsWith(prefix)
    ? dirName.slice(prefix.length)
    : dirName.replace(/^-/, "");
  return name.replace(/-/g, "/");
}

function parseLine(line: string): RawJsonlEntry | null {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

function extractToolResultText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((b) => {
        if (typeof b === "string") return b;
        if (b && typeof b === "object" && "text" in b)
          return String((b as Record<string, unknown>).text ?? "");
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

function buildToolResultMap(
  entries: RawJsonlEntry[]
): Map<string, { text: string; isError: boolean }> {
  const map = new Map<string, { text: string; isError: boolean }>();
  for (const entry of entries) {
    if (entry.type !== "user" || !Array.isArray(entry.message?.content)) continue;
    for (const b of entry.message!.content as Array<Record<string, unknown>>) {
      if (b.type === "tool_result" && typeof b.tool_use_id === "string") {
        map.set(b.tool_use_id, {
          text: extractToolResultText(b.content),
          isError: b.is_error === true,
        });
      }
    }
  }
  return map;
}

function entryToMessage(
  entry: RawJsonlEntry,
  resultMap?: Map<string, { text: string; isError: boolean }>
): ParsedMessage | null {
  if (!entry.uuid || !entry.type || !entry.message) return null;
  if (entry.type !== "user" && entry.type !== "assistant") return null;
  if (entry.isSidechain) return null;
  if (entry.isMeta) return null;

  let images: { id: string; mediaType: string }[] | undefined;
  if (entry.type === "user" && Array.isArray(entry.message.content)) {
    const blocks = entry.message.content as Array<Record<string, unknown>>;
    const hasText = blocks.some(
      (b) => b.type === "text" && typeof b.text === "string"
    );
    const imageBlocks: { id: string; mediaType: string }[] = [];
    blocks.forEach((b, idx) => {
      if (b.type === "image") {
        const src = (b.source ?? {}) as Record<string, unknown>;
        const media =
          typeof src.media_type === "string" ? src.media_type : "image/png";
        imageBlocks.push({ id: `${entry.uuid}:${idx}`, mediaType: media });
      }
    });
    if (!hasText && imageBlocks.length === 0) return null;
    if (imageBlocks.length > 0) images = imageBlocks;
  }

  const msg: ParsedMessage = {
    uuid: entry.uuid,
    type: entry.type,
    timestamp: entry.timestamp || "",
    content: entry.message.content || "",
    model: entry.message.model,
  };
  if (images) msg.images = images;
  if (entry.type === "assistant" && entry.message.model === "<synthetic>") {
    msg.synthetic = true;
  }

  if (entry.type === "assistant" && Array.isArray(entry.message.content)) {
    const toolCalls = (entry.message.content as Array<Record<string, unknown>>)
      .filter((b) => b.type === "tool_use")
      .map((b) => {
        const id = (b.id as string) || "";
        const res = resultMap?.get(id);
        return {
          id,
          name: (b.name as string) || "",
          input: (b.input as Record<string, unknown>) || {},
          result: res?.text,
          isError: res?.isError,
        };
      });
    if (toolCalls.length > 0) {
      msg.toolCalls = toolCalls;
    }
  }

  return msg;
}

function parseJsonlFile(filePath: string): ParsedMessage[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n").filter((l) => l.trim());
  const entries: RawJsonlEntry[] = [];
  for (const line of lines) {
    const entry = parseLine(line);
    if (entry) entries.push(entry);
  }
  const resultMap = buildToolResultMap(entries);
  const raw: ParsedMessage[] = [];
  for (const entry of entries) {
    const msg = entryToMessage(entry, resultMap);
    if (msg) raw.push(msg);
  }
  return mergeMessages(raw);
}

function getFirstUserMessage(filePath: string): string {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n").filter((l) => l.trim());

  for (const line of lines) {
    const entry = parseLine(line);
    if (!entry || entry.type !== "user" || !entry.message) continue;

    const c = entry.message.content;
    let raw = "";
    if (typeof c === "string") {
      raw = c;
    } else if (Array.isArray(c)) {
      const textBlock = c.find(
        (b) => (b as Record<string, unknown>).type === "text"
      );
      if (textBlock) {
        raw = ((textBlock as Record<string, unknown>).text as string) || "";
      }
    }
    const cleaned = stripSystemTags(raw);
    if (cleaned) return cleaned.slice(0, 80);
  }

  return "(empty session)";
}

function getSessionTitle(filePath: string): string {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n").filter((l) => l.trim());

  let customTitle = "";
  let aiTitle = "";

  for (const line of lines) {
    const entry = parseLine(line);
    if (!entry) continue;

    if (entry.type === "custom-title" && (entry as any).customTitle) {
      customTitle = (entry as any).customTitle;
    }
    if (entry.type === "ai-title" && (entry as any).aiTitle) {
      aiTitle = (entry as any).aiTitle;
    }
  }

  if (customTitle) return customTitle;
  if (aiTitle) return aiTitle;
  return getFirstUserMessage(filePath);
}

function parseNewBytes(
  filePath: string,
  fromByte: number
): { messages: ParsedMessage[]; newOffset: number } {
  const stat = fs.statSync(filePath);
  if (stat.size <= fromByte) return { messages: [], newOffset: fromByte };

  const fd = fs.openSync(filePath, "r");
  const buf = Buffer.alloc(stat.size - fromByte);
  fs.readSync(fd, buf, 0, buf.length, fromByte);
  fs.closeSync(fd);

  const text = buf.toString("utf-8");
  const lines = text.split("\n").filter((l) => l.trim());
  const entries: RawJsonlEntry[] = [];
  for (const line of lines) {
    const entry = parseLine(line);
    if (entry) entries.push(entry);
  }
  const resultMap = buildToolResultMap(entries);
  const messages: ParsedMessage[] = [];
  for (const entry of entries) {
    const msg = entryToMessage(entry, resultMap);
    if (msg) messages.push(msg);
  }

  return { messages, newOffset: stat.size };
}

export const claudeSource: CliSource = {
  id: "claude",

  exists() {
    return fs.existsSync(path.join(os.homedir(), ".claude"));
  },

  listProjects(): ProjectInfo[] {
    const projectsDir = getProjectsDir();
    if (!fs.existsSync(projectsDir)) return [];

    const entries = fs.readdirSync(projectsDir, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory())
      .map((e) => {
        const dirPath = path.join(projectsDir, e.name);
        const sessions = fs
          .readdirSync(dirPath)
          .filter((f) => f.endsWith(".jsonl"));
        return {
          name: parseProjectName(e.name),
          dirName: e.name,
          path: dirPath,
          sessionCount: sessions.length,
        };
      })
      .filter((p) => p.sessionCount > 0)
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  listSessions(projectDirName: string): SessionListItem[] {
    const projectDir = path.join(getProjectsDir(), projectDirName);
    if (!fs.existsSync(projectDir)) return [];

    const files = fs
      .readdirSync(projectDir)
      .filter((f) => f.endsWith(".jsonl"));

    const sessions = files.map((f) => {
      const filePath = path.join(projectDir, f);
      const stat = fs.statSync(filePath);
      const id = f.replace(".jsonl", "");

      let firstMessage = "(empty)";
      let messageCount = 0;
      try {
        firstMessage = getSessionTitle(filePath);
        const content = fs.readFileSync(filePath, "utf-8");
        messageCount = content.split("\n").filter((l) => l.trim()).length;
      } catch {
        // skip unreadable files
      }

      return {
        id,
        firstMessage,
        timestamp: stat.mtime.toISOString(),
        messageCount,
      };
    });

    sessions.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return sessions;
  },

  recentSessions(limit: number): SessionListItem[] {
    const projectsDir = getProjectsDir();
    if (!fs.existsSync(projectsDir)) return [];

    const allSessions: SessionListItem[] = [];
    const entries = fs.readdirSync(projectsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const projectDir = path.join(projectsDir, entry.name);
      const files = fs
        .readdirSync(projectDir)
        .filter((f) => f.endsWith(".jsonl"));

      for (const f of files) {
        const filePath = path.join(projectDir, f);
        try {
          const stat = fs.statSync(filePath);
          const id = f.replace(".jsonl", "");
          const firstMessage = getSessionTitle(filePath);
          const content = fs.readFileSync(filePath, "utf-8");
          const messageCount = content
            .split("\n")
            .filter((l) => l.trim()).length;
          allSessions.push({
            id,
            firstMessage,
            timestamp: stat.mtime.toISOString(),
            messageCount,
            project: entry.name,
          });
        } catch {
          // skip unreadable files
        }
      }
    }

    allSessions.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return allSessions.slice(0, limit);
  },

  searchSessions(query: string): SessionListItem[] {
    const q = query.toLowerCase();
    const projectsDir = getProjectsDir();
    if (!fs.existsSync(projectsDir)) return [];

    const results: SessionListItem[] = [];
    const entries = fs.readdirSync(projectsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const pathMatches = parseProjectName(entry.name)
        .toLowerCase()
        .includes(q);

      const projectDir = path.join(projectsDir, entry.name);
      const files = fs
        .readdirSync(projectDir)
        .filter((f) => f.endsWith(".jsonl"));

      for (const f of files) {
        const filePath = path.join(projectDir, f);
        try {
          const title = getSessionTitle(filePath);
          if (!pathMatches && !title.toLowerCase().includes(q)) continue;

          const stat = fs.statSync(filePath);
          const content = fs.readFileSync(filePath, "utf-8");
          const messageCount = content
            .split("\n")
            .filter((l) => l.trim()).length;
          results.push({
            id: f.replace(".jsonl", ""),
            firstMessage: title,
            timestamp: stat.mtime.toISOString(),
            messageCount,
            project: entry.name,
          });
        } catch {
          // skip unreadable files
        }
      }
    }

    results.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return results;
  },

  resolveSessionFile(projectDirName: string, sessionId: string): string | null {
    const filePath = path.join(
      getProjectsDir(),
      projectDirName,
      `${sessionId}.jsonl`
    );
    return fs.existsSync(filePath) ? filePath : null;
  },

  deleteSession(projectDirName: string, sessionId: string): boolean {
    const filePath = this.resolveSessionFile(projectDirName, sessionId);
    if (!filePath) return false;
    try {
      fs.unlinkSync(filePath);
      return true;
    } catch {
      return false;
    }
  },

  parseSession(projectDirName: string, sessionId: string): ParsedMessage[] | null {
    const filePath = this.resolveSessionFile(projectDirName, sessionId);
    if (!filePath) return null;
    return parseJsonlFile(filePath);
  },

  parseNewBytes,

  getImage(projectDirName: string, sessionId: string, imageId: string) {
    const filePath = this.resolveSessionFile(projectDirName, sessionId);
    if (!filePath) return null;
    const sep = imageId.lastIndexOf(":");
    if (sep < 0) return null;
    const targetUuid = imageId.slice(0, sep);
    const blockIdx = parseInt(imageId.slice(sep + 1), 10);
    if (Number.isNaN(blockIdx)) return null;

    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n").filter((l) => l.trim());
    for (const line of lines) {
      const entry = parseLine(line);
      if (!entry || entry.uuid !== targetUuid) continue;
      const msg = entry.message;
      if (!msg || !Array.isArray(msg.content)) return null;
      const block = (msg.content as Array<Record<string, unknown>>)[blockIdx];
      if (!block || block.type !== "image") return null;
      const src = (block.source ?? {}) as Record<string, unknown>;
      if (typeof src.data !== "string") return null;
      const media =
        typeof src.media_type === "string" ? src.media_type : "image/png";
      return {
        mediaType: media,
        buffer: Buffer.from(src.data, "base64"),
      };
    }
    return null;
  },
};

// Re-export helpers used by other parts of the server (none for now).
export { extractText };
