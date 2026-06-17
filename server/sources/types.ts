import type { ParsedMessage } from "../parser.js";

export interface ProjectInfo {
  name: string;
  dirName: string;
  path: string;
  sessionCount: number;
}

export interface SessionListItem {
  id: string;
  firstMessage: string;
  timestamp: string;
  messageCount: number;
  project?: string;
}

export interface CliSource {
  id: "claude" | "trae";
  exists(): boolean;
  listProjects(): ProjectInfo[];
  listSessions(projectDirName: string): SessionListItem[];
  recentSessions(limit: number): SessionListItem[];
  searchSessions(query: string): SessionListItem[];
  parseSession(projectDirName: string, sessionId: string): ParsedMessage[] | null;
  resolveSessionFile(projectDirName: string, sessionId: string): string | null;
  parseNewBytes(filePath: string, fromByte: number): { messages: ParsedMessage[]; newOffset: number };
}
