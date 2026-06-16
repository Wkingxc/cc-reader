# CC Reader 架构文档

面向二次开发的开发者文档。介绍整体框架组成、各模块职责、数据流，以及"想改某处功能该去哪里"。

> 用户向文档（功能介绍、安装运行）见 [README.md](../README.md)。本文档聚焦内部结构。

---

## 1. 技术栈与定位

CC Reader 是一个**纯本地**的 Claude Code 对话查看器：读取 `~/.claude/projects/` 下的 JSONL 日志，在浏览器里渲染成可读的对话界面。无数据库、无外部依赖、不联网、不需要 API Key。

| 层 | 技术 |
|----|------|
| 后端 | Node.js · Express · ws（WebSocket）· chokidar（文件监听）· tsx（直接跑 TS） |
| 前端 | React 18 · Vite · TypeScript · Tailwind CSS 3 |
| 渲染 | react-markdown · remark-gfm · remark-math + rehype-katex（公式）· react-syntax-highlighter（代码高亮） |

后端用 `tsx` 直接运行 TypeScript，**生产环境不编译后端**（`npm start` 只构建前端，后端由 tsx 即时执行）。

---

## 2. 目录结构

```
cc-reader/
├── index.html              入口 HTML，含防闪烁（anti-flash）主题脚本
├── server/                 后端（Express + WebSocket）
│   ├── index.ts            组装服务：Express + ws + 找空闲端口 + 开浏览器
│   ├── parser.ts           ★ 核心：JSONL → 结构化消息（解析/配对/合并/清洗）
│   ├── watcher.ts          chokidar 文件监听，按 WS 客户端增量推送
│   └── routes/
│       ├── projects.ts     GET /api/projects
│       └── sessions.ts     /recent · /search · /:project · /:project/:sessionId
├── src/                    前端（React）
│   ├── main.tsx            React 挂载入口
│   ├── App.tsx             ★ 状态中枢：标签页、活动会话、WebSocket 接线
│   ├── index.css           主题 CSS 变量、动画、prose 排版样式
│   ├── components/         UI 组件（见 §5）
│   ├── hooks/              useTheme / useIsDark / useFontSize / useWebSocket / useScrollTo
│   ├── types/message.ts    全局 TypeScript 类型定义
│   └── utils/parseContent.ts  前端文本提取 / 工具摘要 / 公式解包
├── vite.config.ts          Vite + 开发代理（/api、/ws → :3456）
├── tailwind.config.js      语义色 token → CSS 变量映射
├── tsconfig.json           前端 TS 配置（include: src）
└── tsconfig.server.json    后端 TS 配置（include: server）
```

★ 标记的是理解全局最关键的两个文件：`server/parser.ts`（数据怎么来）和 `src/App.tsx`（数据怎么流）。

---

## 3. 整体架构与数据流

```
~/.claude/projects/<项目目录>/<会话>.jsonl   ← Claude Code 写入的原始日志
        │
        │  ① 首屏 / 切换会话：REST 全量拉取
        │  ② 对话进行中：WebSocket 增量推送
        ▼
┌─────────────────────────────────────────┐
│  后端 (server/)                          │
│   parser.ts   解析 JSONL → 结构化消息    │
│   routes/     REST：项目 / 会话 / 消息   │
│   watcher.ts  监听文件变化 → WS 推送增量  │
└─────────────────────────────────────────┘
        │  JSON over HTTP / WebSocket
        ▼
┌─────────────────────────────────────────┐
│  前端 (src/)                             │
│   App.tsx     标签页与活动会话状态        │
│   MessageList → User/AssistantMessage    │
│      → MarkdownContent（MD/代码/公式）   │
│      → ToolCallBlock（工具调用）         │
└─────────────────────────────────────────┘
```

**两条数据通路**：

1. **全量加载**（REST）：用户在侧栏点开一个会话 → `GET /api/sessions/:project/:sessionId` → 后端 `parseJsonlFile` 整文件解析返回。切换标签页也走这条，保证工具结果等被完整重新配对。
2. **实时增量**（WebSocket）：打开会话后前端发 `{type:"watch"}`，后端用 chokidar 监听该文件；文件追加内容时，`parseNewLines` 只解析新增字节，通过 WS 推 `{type:"new-messages"}`，前端把新消息 append 到当前标签页。

---

## 4. 后端详解

### 4.1 parser.ts —— 解析管线（核心）

这是整个项目最核心的文件。它把 Claude Code 的原始 JSONL（每行一个 JSON 事件）转换成前端能直接渲染的 `ParsedMessage[]`。

**全量解析 `parseJsonlFile(filePath)` 的流水线**：

1. **读取分行** → 每行 `parseLine` 解析成 `RawJsonlEntry`（容错：解析失败的行跳过）。
2. **构建工具结果表 `buildToolResultMap`** → 扫描所有 `user` 条目里的 `tool_result` 块，按 `tool_use_id` 建索引（含 `is_error`）。这是"接上断线"的关键：工具调用（`tool_use`）和它的结果（`tool_result`）在 JSONL 里是分开的两条记录。
3. **逐条转换 `entryToMessage`** → 过滤掉 sidechain / meta / 无文本的纯工具用户条目；对 `assistant` 条目提取 `tool_use` 块并用上一步的结果表回填 `result`/`isError`。
4. **合并 `mergeMessages`** → 把**连续同角色**的条目合并成一条（拼接文本、合并 toolCalls），并剔除合并后仍为空的消息。

**其他关键函数**：

| 函数 | 作用 |
|------|------|
| `parseProjectName(dirName)` | 把目录名 `-Users-xxx-foo-bar` 还原成路径 `foo/bar`（去掉 home 前缀，`-` 换 `/`） |
| `getSessionTitle(filePath)` | 会话标题优先级：`custom-title` > `ai-title` > 首条用户消息（`getFirstUserMessage`，截断 80 字） |
| `stripSystemTags(text)` | 剥离 `<system-reminder>` / `<local-command-*>` / `<command-*>` / `<bridge_context>` 等系统标签，只留真实对话 |
| `parseNewLines(filePath, fromByte)` | **增量解析**：从指定字节偏移读取新增内容，返回新消息 + 新偏移量。供 watcher 使用 |

> ⚠️ **增量解析的已知约束**：`parseNewLines` 只在当前字节块内配对工具结果。若某个 `tool_use` 的 `tool_result` 落在后续块，结果会暂时缺失（`result=undefined`），直到切换标签页触发全量 `parseJsonlFile` 重新配对补齐。代码里有注释标注这一点。

### 4.2 routes —— REST 接口

| 方法 & 路径 | 说明 | 返回 |
|-------------|------|------|
| `GET /api/projects` | 列出所有有会话的项目，按名排序 | `Project[]` |
| `GET /api/sessions/recent` | 全局最近 5 个会话（按 mtime） | `SessionInfo[]`（含 `project`） |
| `GET /api/sessions/search?q=` | 按路径名或会话标题搜索 | `SessionInfo[]`（含 `project`） |
| `GET /api/sessions/:project` | 某项目下所有会话 | `SessionInfo[]` |
| `GET /api/sessions/:project/:sessionId` | 单个会话的完整消息 | `Message[]` |

> ⚠️ **路由注册顺序**：`/recent` 和 `/search` 必须注册在 `/:project` **之前**，否则 Express 会把 `recent`/`search` 当成项目名。改 `sessions.ts` 时注意这点。

### 4.3 watcher.ts —— 实时监听

- 每个 WebSocket 客户端维护一份 `WatchState`（监听的文件、当前字节偏移、chokidar watcher 实例）。
- `handleWatch` 启动监听，初始 offset = 当前文件大小（只推后续新增，不重发历史）。
- 文件 `change` 事件触发 `parseNewLines`，把新消息通过 WS 推给该客户端，并前移 offset。
- `awaitWriteFinish` 防抖（200ms），避免半行写入被解析。
- 一个客户端同时只监听一个文件，`handleWatch` 会先 `stopWatch` 清掉旧的。

### 4.4 index.ts —— 服务组装

- Express 挂载 `/api/projects`、`/api/sessions` 路由；生产模式下静态托管 `dist/` 并对非 API 路由回退 `index.html`（SPA）。
- 在同一个 HTTP server 上挂 WebSocketServer（path `/ws`），消息类型：`watch` / `unwatch`。
- `findOpenPort` 从 `PORT`（默认 3456）起递增找空闲端口。
- 启动后用系统命令自动打开浏览器（`open`/`start`/`xdg-open`）。
- 启动前检查 `~/.claude` 是否存在，不存在则报错退出。

---

## 5. 前端详解

### 5.1 状态中枢 App.tsx

`App` 持有所有顶层状态，是数据流的汇聚点：

- **`tabs: TabData[]` + `activeTabId`** —— 多标签页。每个标签页缓存自己的 `messages`。
- **打开会话 `handleOpenTab`**：已打开则激活；否则 `fetch` 全量消息建新标签页。无论哪种都会 `unwatch()` 旧的、`watch()` 新的。
- **接收实时消息 `handleNewMessages`**：WebSocket 推来的新消息 append 到**当前活动**标签页（用 `activeTabIdRef` 避免闭包过期）。
- **派生数据**（`useMemo`）：问题列表 `questions`、用户提问序号映射 `userQuestionIndices`、已打开会话 id 集合 `openSessionIds`。

布局：`Sidebar`（左）│ `TabBar` + `Toolbar` + `MessageList`（中）│ `QuestionNav`（右）。

### 5.2 渲染管线

```
MessageList            滚动容器；新消息时若用户在底部则自动滚到底
  ├─ UserMessage       用户消息（左边框强调样式，带提问序号 #n）
  └─ AssistantMessage  Claude 消息（卡片样式，含 model 标签）
        ├─ MarkdownContent   Markdown 正文渲染
        └─ ToolCallBlock     工具调用（可折叠，显示 Input / Output）
```

**MarkdownContent** 是渲染核心，组合了一条 react-markdown 管线：

- `remarkGfm` —— 表格、删除线等 GitHub 风格扩展
- `remarkMath` + `rehypeKatex` —— LaTeX 公式（`$...$` / `$$...$$`）
- 自定义 `code` 组件：带语言的代码块走 `react-syntax-highlighter`（Prism），明暗主题由 `useIsDark` 决定用 `oneDark`/`oneLight`；无语言的多行代码走简易 `<pre>`；行内代码走 `<code>` 样式
- 渲染前先经 `unwrapInlineMath` 预处理（见 §7）

### 5.3 主题系统

三主题（浅紫 / 浅蓝 / 暗色），实现要点：

1. **CSS 变量驱动**（`src/index.css`）：定义一组语义色 `--c-base` / `--c-side` / `--c-accent` / … 共 10 个 token，每个主题一套取值。
2. **Tailwind 语义色**（`tailwind.config.js`）：把 `--c-*` 注册成 `bg-base`、`text-ink`、`border-edge` 等类名。**组件只用语义色类，从不写死颜色**——这是加主题零改组件的根本原因。
3. **主题切换**（`useTheme`）：在 `<html>` 上设 `data-theme="light|blue|dark"` 选配色；**暗色额外加 `.dark` class**，以复用既有 `.dark`-scoped 的 prose/katex 样式和 `useIsDark`（代码高亮明暗判断）。状态持久化到 localStorage。
4. **防闪烁**（`index.html` 内联脚本）：React 加载前先从 localStorage 读主题并设好 `data-theme`/`.dark`，避免首屏白闪。
5. **选择器 UI**（`Toolbar.tsx`）：弹出式面板，每个主题显示色块预览 + 当前打勾，点击外部/Esc 关闭。

### 5.4 hooks 一览

| Hook | 职责 |
|------|------|
| `useTheme` | 三态主题状态 + `data-theme`/`.dark` 同步 + localStorage 持久化 |
| `useIsDark` | 用 MutationObserver 监听 `.dark` class，供代码高亮选明暗样式 |
| `useFontSize` | 字号状态（12–28px）+ `Ctrl/Cmd +/-` 快捷键 + 持久化，写入 `--font-size` 变量 |
| `useWebSocket` | WS 连接、自动重连（指数退避，上限 30s）、`watch`/`unwatch`、连接状态 |
| `useScrollTo` | 按消息 uuid 平滑滚动并短暂高亮（QuestionNav 跳转用） |

---

## 6. 类型契约

所有跨层类型定义在 `src/types/message.ts`，与后端 `parser.ts` 的 `ParsedMessage` 对应：

- `Project` —— 项目（`name` 显示名 / `dirName` 目录名 / `sessionCount`）
- `SessionInfo` —— 会话条目（`id` / `firstMessage` 标题 / `timestamp` / `messageCount` / 可选 `project`）
- `Message` —— 一条消息（`type` user/assistant / `content` / 可选 `toolCalls` / `model`）
- `ToolCall` —— 工具调用（`name` / `input` / 可选 `result` / `isError`）
- `TabData` —— 标签页（会话信息 + 已加载的 `messages`）
- `WsMessage` —— WebSocket 消息信封

> 后端返回的字段名需与这些类型保持一致。改后端返回结构时，同步更新这里。

---

## 7. 关键设计决策

- **后端不编译，tsx 直跑**：简化部署，`npm start` 只构建前端。`tsconfig.server.json` 仅用于类型检查/可选编译。
- **工具调用"接断线"**：`tool_use` 与 `tool_result` 在 JSONL 中分离，靠 `buildToolResultMap` 按 id 配对——理解工具结果显示必须抓住这点。
- **连续同角色合并**：Claude 的一次回复可能拆成多条 JSONL 记录，`mergeMessages` 合并它们，让 UI 呈现为单条消息。
- **系统标签双端剥离**：`stripSystemTags` 在后端（parser）和前端（parseContent）各有一份，确保无论哪条通路进来的文本都干净。两处规则需保持同步。
- **CSS 变量 + 语义色**：组件不写死颜色，所以新增主题只需加一套变量，零改组件。
- **公式反引号解包 `unwrapInlineMath`**：有些公式被 ``` `$...$` ``` 反引号包住，会被当成行内代码而非公式。此函数在渲染前把"整体就是一段 `$...$`"的反引号解开交给数学插件，同时跳过 ``` ``` 围栏代码块避免误伤 shell 代码。
- **增量解析的偏移管理**：watcher 按字节 offset 增量读，省去每次全量解析；代价是跨块的工具结果需全量重载补齐（见 §4.1 约束）。

---

## 8. 二次开发指引：想改 X 去哪里

| 需求 | 改这里 |
|------|--------|
| 新增/调整主题配色 | `src/index.css`（加一套 `[data-theme=...]` 变量）+ `useTheme.ts`（Theme 类型与列表）+ `Toolbar.tsx`（选择器选项） |
| 改某个工具调用的摘要显示 | `src/utils/parseContent.ts` 的 `getToolSummary` |
| 工具调用的展开/输出 UI | `src/components/ToolCallBlock.tsx` |
| Markdown/代码/表格/链接渲染 | `src/components/MarkdownContent.tsx` |
| 新增系统标签的剥离规则 | `server/parser.ts` 和 `src/utils/parseContent.ts` 的 `stripSystemTags`（**两处都要改**） |
| 会话标题的取法 | `server/parser.ts` 的 `getSessionTitle` |
| 新增 REST 接口 | `server/routes/`（注意 `sessions.ts` 的路由顺序，静态段在 `/:param` 之前） |
| 实时推送逻辑 / 监听策略 | `server/watcher.ts` |
| 侧栏搜索/分页/树展示 | `src/components/Sidebar.tsx` + `routes/sessions.ts` 的 `/search` |
| 字号范围/快捷键 | `src/hooks/useFontSize.ts` |
| 消息卡片样式（用户/Claude） | `src/components/UserMessage.tsx` / `AssistantMessage.tsx` |
| 标签页行为 | `src/components/TabBar.tsx` + `App.tsx` 的 tab 状态逻辑 |
| 问题导航面板 | `src/components/QuestionNav.tsx` + `App.tsx` 的 `questions` 派生 |
| 默认端口 / 启动行为 | `server/index.ts`（`PORT` 环境变量、`findOpenPort`、开浏览器命令） |
| 开发代理端口 | `vite.config.ts` |

---

## 9. 本地开发

```bash
npm install
npm run dev      # 前端热更新(:5173) + 后端自动重启(:3456)
```

- 开发时访问 **5173**（前端 dev server），Vite 代理把 `/api`、`/ws` 转发到后端 3456。
- 改后端文件 → tsx watch 自动重启；改前端 → Vite HMR 即时生效。
- 类型检查：`npx tsc --noEmit`（前端）。

生产构建运行：`npm start`（构建前端 → tsx 启动后端，单端口同时提供 API 与页面）。
