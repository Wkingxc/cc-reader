import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export interface RawJsonlEntry {
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
}

export interface ParsedMessage {
  uuid: string;
  type: "user" | "assistant";
  timestamp: string;
  content: string | Array<Record<string, unknown>>;
  toolCalls?: Array<{ id: string; name: string; input: Record<string, unknown> }>;
  model?: string;
}

export function getClaudeDir(): string {
  return path.join(os.homedir(), ".claude");
}

export function getProjectsDir(): string {
  return path.join(getClaudeDir(), "projects");
}

export function parseProjectName(dirName: string): string {
  const home = os.homedir();
  const parts = home.split(path.sep);
  const user = parts[parts.length - 1];
  const prefix = `-Users-${user}-`;
  const name = dirName.startsWith(prefix)
    ? dirName.slice(prefix.length)
    : dirName.replace(/^-/, "");
  return name.replace(/-/g, "/");
}

export function parseLine(line: string): RawJsonlEntry | null {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

export function entryToMessage(entry: RawJsonlEntry): ParsedMessage | null {
  if (!entry.uuid || !entry.type || !entry.message) return null;
  if (entry.type !== "user" && entry.type !== "assistant") return null;
  if (entry.isSidechain) return null;

  const msg: ParsedMessage = {
    uuid: entry.uuid,
    type: entry.type,
    timestamp: entry.timestamp || "",
    content: entry.message.content || "",
    model: entry.message.model,
  };

  if (entry.type === "assistant" && Array.isArray(entry.message.content)) {
    const toolCalls = (entry.message.content as Array<Record<string, unknown>>)
      .filter((b) => b.type === "tool_use")
      .map((b) => ({
        id: (b.id as string) || "",
        name: (b.name as string) || "",
        input: (b.input as Record<string, unknown>) || {},
      }));
    if (toolCalls.length > 0) {
      msg.toolCalls = toolCalls;
    }
  }

  return msg;
}

export function parseJsonlFile(filePath: string): ParsedMessage[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n").filter((l) => l.trim());
  const messages: ParsedMessage[] = [];

  for (const line of lines) {
    const entry = parseLine(line);
    if (!entry) continue;
    const msg = entryToMessage(entry);
    if (msg) messages.push(msg);
  }

  return messages;
}

export function getFirstUserMessage(filePath: string): string {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n").filter((l) => l.trim());

  for (const line of lines) {
    const entry = parseLine(line);
    if (!entry || entry.type !== "user" || !entry.message) continue;

    const c = entry.message.content;
    if (typeof c === "string") {
      return c.slice(0, 80);
    }
    if (Array.isArray(c)) {
      const textBlock = c.find((b) => (b as Record<string, unknown>).type === "text");
      if (textBlock) {
        return ((textBlock as Record<string, unknown>).text as string || "").slice(0, 80);
      }
    }
    return "(no text)";
  }

  return "(empty session)";
}

export function parseNewLines(filePath: string, fromByte: number): { messages: ParsedMessage[]; newOffset: number } {
  const stat = fs.statSync(filePath);
  if (stat.size <= fromByte) return { messages: [], newOffset: fromByte };

  const fd = fs.openSync(filePath, "r");
  const buf = Buffer.alloc(stat.size - fromByte);
  fs.readSync(fd, buf, 0, buf.length, fromByte);
  fs.closeSync(fd);

  const text = buf.toString("utf-8");
  const lines = text.split("\n").filter((l) => l.trim());
  const messages: ParsedMessage[] = [];

  for (const line of lines) {
    const entry = parseLine(line);
    if (!entry) continue;
    const msg = entryToMessage(entry);
    if (msg) messages.push(msg);
  }

  return { messages, newOffset: stat.size };
}
