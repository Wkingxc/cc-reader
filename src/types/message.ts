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

export interface Message {
  uuid: string;
  type: "user" | "assistant";
  timestamp: string;
  content: MessageContent;
  toolCalls?: ToolCall[];
  model?: string;
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
}

export interface TabData {
  id: string;
  project: string;
  session: SessionInfo;
  messages: Message[];
}

export interface WsMessage {
  type: "watch" | "unwatch" | "new-messages" | "session-updated";
  project?: string;
  session?: string;
  messages?: Message[];
  sessionId?: string;
}
