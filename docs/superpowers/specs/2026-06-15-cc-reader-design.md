# CC-Reader 设计文档

Claude Code 对话历史本地查看器。

## 目标

提供一个本地 Web 服务，让用户在浏览器中舒适地阅读 Claude Code 的对话历史。解决终端字体不友好、无法调整字体大小、无法快速跳转到特定问题的痛点。

## 非目标

- 不做全文搜索
- 不做统计/分析
- 不做多 AI provider 支持（只读 Claude Code）
- 不做主题切换（默认暗色主题）
- 不做会话编辑/删除
- 不做导出/分享

## 技术栈

| 层 | 技术 | 版本 |
|----|------|------|
| 后端 | Node.js + Express | ^4.x |
| 实时通信 | ws | ^8.x |
| 文件监听 | chokidar | ^3.x |
| 前端框架 | React 18 + TypeScript | ^18.x |
| 构建 | Vite | ^5.x |
| Markdown 渲染 | react-markdown + remark-gfm | latest |
| 代码高亮 | react-syntax-highlighter | latest |
| 样式 | Tailwind CSS | ^3.x |

运行时依赖共 3 个 npm 包（express、ws、chokidar）。前端依赖通过 Vite 打包到静态文件中。

## 数据源

Claude Code 对话数据存储在 `~/.claude/projects/` 下：

```
~/.claude/projects/
  -Users-bytedance-project-a/
    session-uuid-1.jsonl
    session-uuid-2.jsonl
  -Users-bytedance-project-b/
    session-uuid-3.jsonl
```

每个 JSONL 文件是一个会话，每行一个 JSON 对象。关键消息类型：

- `type: "user"` — 用户消息，`message.content` 为字符串或数组
- `type: "assistant"` — AI 回复，`message.content` 为 content block 数组（text、tool_use、thinking 等）
- `type: "summary"` — 上下文压缩摘要
- 其他元数据类型：`last-prompt`、`mode`、`permission-mode`、`ai-title` 等（不展示）

## 项目结构

```
cc-reader/
├── server/
│   ├── index.ts              # Express + WS 服务入口
│   ├── routes/
│   │   ├── projects.ts       # GET /api/projects — 项目列表
│   │   └── sessions.ts       # GET /api/sessions/:project — 会话列表
│   │                         # GET /api/messages/:project/:session — 消息
│   ├── watcher.ts            # chokidar 文件监听 + WS 推送
│   └── parser.ts             # JSONL 解析和消息格式化
├── src/
│   ├── App.tsx               # 根组件：左右分栏布局
│   ├── main.tsx              # React 入口
│   ├── index.css             # Tailwind 入口
│   ├── components/
│   │   ├── Sidebar.tsx           # 左侧栏：项目树 + 会话列表
│   │   ├── SessionItem.tsx       # 单个会话条目
│   │   ├── MessageList.tsx       # 消息列表容器
│   │   ├── UserMessage.tsx       # 用户消息气泡
│   │   ├── AssistantMessage.tsx  # AI 回复气泡
│   │   ├── ToolCallBlock.tsx     # 可折叠工具调用
│   │   ├── MarkdownContent.tsx   # Markdown 渲染封装
│   │   ├── Toolbar.tsx           # 顶部工具栏
│   │   └── QuestionNav.tsx       # 问题快速跳转浮动面板
│   ├── hooks/
│   │   ├── useWebSocket.ts       # WS 连接 + 重连
│   │   ├── useFontSize.ts        # 字体大小管理（localStorage）
│   │   └── useScrollTo.ts        # 滚动定位
│   ├── types/
│   │   └── message.ts            # 消息类型定义
│   └── utils/
│       └── parseContent.ts       # 前端消息内容解析
├── scripts/
│   └── start.sh              # 一键启动脚本
├── package.json
├── tsconfig.json
├── tsconfig.server.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
└── README.md
```

## API 设计

### REST API

```
GET /api/projects
  返回：[{ name: string, path: string, sessionCount: number }]

GET /api/sessions/:projectName
  返回：[{ id: string, firstMessage: string, timestamp: string, messageCount: number }]

GET /api/messages/:projectName/:sessionId
  返回：Message[]（已过滤和格式化）
```

### WebSocket

```
连接：ws://localhost:PORT/ws

客户端 → 服务端：
  { type: "watch", project: string, session: string }   # 开始监听某个会话
  { type: "unwatch" }                                    # 停止监听

服务端 → 客户端：
  { type: "new-messages", messages: Message[] }          # 新消息追加
  { type: "session-updated", sessionId: string }         # 会话列表变化
```

## 消息类型定义

```typescript
interface Message {
  uuid: string;
  type: "user" | "assistant";
  timestamp: string;
  content: MessageContent;
  toolCalls?: ToolCall[];
  model?: string;
}

type MessageContent = string | ContentBlock[];

interface ContentBlock {
  type: "text" | "tool_use" | "tool_result" | "thinking" | "redacted_thinking";
  text?: string;
  thinking?: string;
  name?: string;       // tool_use
  input?: unknown;     // tool_use
  content?: string;    // tool_result
}

interface ToolCall {
  name: string;
  input: unknown;
  result?: string;
}
```

## 核心功能

### 1. 会话浏览（Sidebar）

- 读取 `~/.claude/projects/` 下所有项目目录
- 每个项目下列出 JSONL 会话文件
- 会话显示信息：首条用户消息前 50 字 + 时间
- 按最后修改时间倒序
- 项目名称：去掉 `-Users-bytedance-` 前缀，恢复路径分隔符

### 2. 消息渲染

**用户消息**
- 左上角 "You" 标签 + 蓝色强调
- content 为字符串时直接 Markdown 渲染
- content 为数组时提取 text 类型的 block

**AI 回复**
- 左上角 "Claude" 标签
- 遍历 content 数组：
  - `type: "text"` → Markdown 渲染（代码块带语法高亮）
  - `type: "tool_use"` → 折叠显示：工具名 + 简要参数
  - `type: "tool_result"`（在 user 消息中） → 折叠显示结果
  - `type: "thinking"` / `type: "redacted_thinking"` → 不显示
- 非 text/tool_use 类型的 block 静默忽略

**工具调用折叠块**
- 默认折叠，显示一行摘要：工具图标 + 名称 + 关键参数
- 点击展开查看完整 input/output
- 摘要规则：
  - Read → "Read: {filePath}"
  - Bash → "Bash: {command 前 60 字符}"
  - Edit → "Edit: {filePath}"
  - Write → "Write: {filePath}"
  - 其他 → "{toolName}"

### 3. 字体控制

- 工具栏两个按钮：`A−` 和 `A+`
- 快捷键：`Ctrl/Cmd + =` 放大，`Ctrl/Cmd + -` 缩小
- 范围：12px ~ 28px，步进 2px，默认 16px
- 通过 CSS 变量 `--font-size` 控制，仅作用于消息区域
- 大小偏好存入 localStorage，刷新保持

### 4. 问题快速跳转（QuestionNav）

- 右侧浮动面板，半透明背景
- 列出当前会话所有 `type: "user"` 消息
- 每条显示："#N" + 消息前 40 字符
- 点击平滑滚动到对应消息
- 当前可见的问题高亮
- 可以收起/展开

### 5. 实时监听

- 当用户打开某个会话时，后端 chokidar 开始 watch 对应 JSONL
- 文件追加新行时，解析新增行，通过 WS 推送
- 后端记录文件上次读取的字节位置，只读增量
- 前端收到后追加到列表尾部
- 如果用户已滚动到底部，自动滚动到新消息

### 6. 启动方式

```bash
# 首次使用
cd cc-reader
npm install

# 启动
npm start          # 构建前端 + 启动服务 + 打开浏览器
# 或
npm run dev        # 开发模式（Vite HMR + 后端 nodemon）
```

`npm start` 执行流程：
1. `vite build` 构建前端到 `dist/`
2. `ts-node server/index.ts` 启动 Express 服务
3. Express 静态托管 `dist/`
4. 自动打开浏览器到 `http://localhost:3456`

## UI 风格

- 暗色主题（`bg-gray-900` 为主背景）
- 左侧栏深色（`bg-gray-800`），宽度 280px，可拖拽调整
- 消息区域使用明确的视觉区分：
  - 用户消息：左侧蓝色竖线 + 略深背景
  - AI 回复：无边框，默认背景
  - 工具调用：灰色虚线边框，等宽字体
- 字体：系统默认等宽字体栈（`ui-monospace, Menlo, Monaco, monospace`）
- 消息间距适当（16px）

## 错误处理

- `~/.claude` 目录不存在：启动时提示，显示友好错误页
- JSONL 某行解析失败：跳过该行，不中断
- WebSocket 断开：前端自动重连（指数退避，最大 30s）
- 端口占用：尝试 3456，占用则自增尝试
