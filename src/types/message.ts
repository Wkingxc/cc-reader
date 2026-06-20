export type CliId = "claude" | "trae" | "codex";

export interface CliOption {
  id: CliId;
  label: string;
}

export interface Project {
  name: string;
  dirName: string;
  path: string;
  sessionCount: number;
}

export interface SessionInfo {
  id: string;
  firstMessage: string;
  timestamp: string;
  messageCount: number;
  project?: string;
}

export interface ImageRef {
  id: string;
  mediaType: string;
}

export interface Message {
  uuid: string;
  type: "user" | "assistant";
  timestamp: string;
  content: MessageContent;
  toolCalls?: ToolCall[];
  model?: string;
  images?: ImageRef[];
}

export type MessageContent = string | ContentBlock[];

export interface ContentBlock {
  type: string;
  text?: string;
  thinking?: string;
  name?: string;
  id?: string;
  input?: Record<string, unknown>;
  content?: string;
  data?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  result?: string;
  isError?: boolean;
}

export interface TabData {
  id: string;
  cli: CliId;
  project: string;
  session: SessionInfo;
  messages: Message[];
  totalRounds: number;
  oldestLoadedRound: number;
  hasMore: boolean;
  loadingMore?: boolean;
}

export interface SessionPage {
  messages: Message[];
  totalRounds: number;
  oldestLoadedRound: number;
  hasMore: boolean;
}

export interface WsMessage {
  type: "watch" | "unwatch" | "new-messages" | "session-updated";
  cli?: CliId;
  project?: string;
  session?: string;
  messages?: Message[];
  sessionId?: string;
}
