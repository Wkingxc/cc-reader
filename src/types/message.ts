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
  // assistant 一轮回复里被工具调用打断的各段文字（终端里的每个 ● 白点），
  // 按时间顺序保留。前端据此把中间旁白折叠、只展示最后一段收尾总结。
  // 与后端 ParsedMessage.segments 对齐；content 仍为全部段拼接。
  segments?: string[];
  // 后端标记的合成占位条目（model:"<synthetic>"）：/rename、/resume 等本地
  // 命令后的 "No response requested."、"API Error: ..." 等系统事件。
  synthetic?: boolean;
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
