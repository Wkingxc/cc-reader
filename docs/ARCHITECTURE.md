# CC Reader 架构文档

面向二次开发的开发者文档。介绍整体框架组成、各模块职责、数据流，以及"想改某处功能该去哪里"。

> 用户向文档（功能介绍、安装运行）见 [README.md](../README.md)。本文档聚焦内部结构。

---

## 1. 技术栈与定位

CC Reader 是一个**纯本地**的 CLI 对话查看器：读取 `~/.claude/projects/`（Claude Code）、`~/.trae/cli/sessions/`（TRAE CLI）和 `~/.codex/sessions/`（Codex CLI）下的 JSONL 日志，在浏览器里渲染成可读的对话界面。无数据库、无外部依赖、不联网、不需要 API Key。

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
├── index.html              入口 HTML，含防闪烁（anti-flash）主题脚本与 favicon link
├── public/
│   └── favicon.svg         站点图标（紫色对话气泡 + CC 字样）
├── server/                 后端（Express + WebSocket）
│   ├── index.ts            组装服务：Express + ws + 找空闲端口 + 开浏览器
│   ├── parser.ts           ★ 通用 helper：ParsedMessage / ImageRef / stripSystemTags / extractText / mergeMessages
│   ├── watcher.ts          chokidar 文件监听，按 WS 客户端增量推送（cli 维度）
│   ├── sources/            ★ CLI 数据源抽象（多 CLI 入口）
│   │   ├── types.ts        CliSource 接口（projects/sessions/parse/getImage…）
│   │   ├── claude.ts       Claude Code（~/.claude）实现
│   │   ├── trae.ts         TRAE CLI（~/.trae/cli/sessions/YYYY/MM/DD/rollout-*.jsonl）实现
│   │   ├── codex.ts        Codex CLI（~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl）实现
│   │   └── index.ts        getSource(id) 路由 + getAvailableCliIds 探测
│   └── routes/
│       ├── projects.ts     GET /api/projects?cli=
│       ├── sessions.ts     /recent · /search · /:project · /:project/:sessionId（轮分页 · DELETE 真删）
│       └── images.ts       GET /api/image/:project/:sessionId/:imageId 流式输出 PNG/JPEG
├── src/                    前端（React）
│   ├── main.tsx            React 挂载入口
│   ├── App.tsx             ★ 状态中枢：标签页、活动会话、CLI、收藏、WS、轮分页
│   ├── index.css           主题 CSS 变量、动画、prose 排版样式
│   ├── components/         UI 组件（见 §5）
│   ├── hooks/              useTheme / useIsDark / useFontSize / useWebSocket / useScrollTo / useCli / useFavorites / useShowTools / useReadingWidth
│   ├── types/message.ts    全局 TypeScript 类型定义（含 CliId / ImageRef / SessionPage / TabData 等）
│   └── utils/parseContent.ts  前端文本提取 / 工具摘要 / 公式解包
├── vite.config.ts          Vite + 开发代理（/api、/ws → :3456）
├── tailwind.config.js      语义色 token → CSS 变量映射
├── tsconfig.json           前端 TS 配置（include: src）
└── tsconfig.server.json    后端 TS 配置（include: server）
```

★ 标记的是理解全局最关键的三处：`server/sources/`（多 CLI 数据来源）、`server/parser.ts`（通用消息形状）和 `src/App.tsx`（数据怎么流）。

---

## 3. 整体架构与数据流

```
~/.claude/projects/<encoded-cwd>/<会话>.jsonl       ← Claude Code 写入
~/.trae/cli/sessions/YYYY/MM/DD/rollout-*.jsonl     ← TRAE CLI 写入
~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl         ← Codex CLI 写入
        │
        │  ① 首屏 / 切换会话：REST 拉取（按需轮分页）
        │  ② 对话进行中：WebSocket 增量推送
        │  ③ 用户消息里粘贴的图片：按需流式 GET /api/image/...
        ▼
┌───────────────────────────────────────────────────┐
│  后端 (server/)                                    │
│   sources/   CliSource 抽象（claude / trae）        │
│   parser.ts  通用消息形状 + 系统标签清洗            │
│   routes/    REST：clis / projects / sessions /     │
│              images（按 ?cli= 路由到对应 source）   │
│   watcher.ts 监听文件变化 → WS 推送增量             │
└───────────────────────────────────────────────────┘
        │  JSON over HTTP / WebSocket / image bytes
        ▼
┌───────────────────────────────────────────────────┐
│  前端 (src/)                                       │
│   App.tsx     标签页 / 活动会话 / CLI / 收藏状态   │
│   Sidebar     CLI 切换 + Favorites + Recent + 树   │
│   QuestionNav 提问导航 + "加载更早 10 轮" 按钮      │
│   MessageList → User/AssistantMessage              │
│      → MarkdownContent（MD/代码/公式）             │
│      → ToolCallBlock（工具调用）                   │
│      → <img src="/api/image/..."> 按需懒加载       │
└───────────────────────────────────────────────────┘
```

**多条数据通路**：

1. **CLI 选择**：前端启动时 `GET /api/clis` 探测本机已安装哪些 CLI；`useCli` 把当前选择持久化到 localStorage。所有后续 REST/WS 请求都带 `?cli=claude|trae|codex` 或 `{cli}` 字段，后端 `getSource(id)` 路由到对应实现。
2. **轮分页加载**（REST）：用户在侧栏点开会话 → `GET /api/sessions/:project/:sessionId?cli=&recentRounds=10`，只返回最近 10 轮（一轮 = 一次用户提问 + 它之后的所有 assistant/tool 消息）。点击 QuestionNav 顶部"加载更早 10 轮"则发 `&beforeRound=N&rounds=10`，把更老的轮 prepend 到 messages。响应形状 `{messages, totalRounds, oldestLoadedRound, hasMore}`。
3. **实时增量**（WebSocket）：打开会话后前端发 `{type:"watch", cli, project, session}`；后端 watcher 用 chokidar 监听该文件并通过对应 source 的 `parseNewBytes` 增量解析，通过 WS 推 `{type:"new-messages"}`，前端 append 到当前标签页。
4. **图片按需**（仅 Claude）：解析时 user 消息的 `image` 块**不返回 base64**，只附带轻量引用 `{id: "<msgUuid>:<idx>", mediaType}`。前端 `<img src="/api/image/:project/:sessionId/:imageId?cli=claude">` 触发后端 `claudeSource.getImage` 重新读 jsonl 那条记录、解码 base64 流式返回。浏览器自带 HTTP 缓存避免重复读取。

---

## 4. 后端详解

### 4.1 sources/ —— CLI 数据源抽象（核心）

每个 CLI 实现一份 `CliSource`（`server/sources/types.ts`）：

```ts
interface CliSource {
  id: "claude" | "trae" | "codex";
  exists(): boolean;
  listProjects(): ProjectInfo[];
  listSessions(projectDirName: string): SessionListItem[];
  recentSessions(limit: number): SessionListItem[];
  searchSessions(query: string): SessionListItem[];
  parseSession(projectDirName, sessionId): ParsedMessage[] | null;
  resolveSessionFile(projectDirName, sessionId): string | null;
  parseNewBytes(filePath, fromByte): { messages, newOffset };
  getImage?(projectDirName, sessionId, imageId): { mediaType, buffer } | null;
}
```

`server/sources/index.ts` 维护注册表：`getSource(id)` 按 `?cli=` 路由，`getAvailableCliIds()` 探测本机哪些 CLI 已安装（用来给 `/api/clis` 接口）。

**`claude.ts`**：处理 `~/.claude/projects/<encoded-cwd>/<sessionId>.jsonl`。
- 项目目录名 `-Users-xxx-foo-bar` 还原成路径 `foo/bar`（去 home 前缀，`-` 换 `/`）。
- JSONL 每行一个事件，`parseJsonlFile` 全流程：解析 → `buildToolResultMap`（按 `tool_use_id` 索引 user 条目里的 `tool_result` 块）→ `entryToMessage` → `mergeMessages`。
- 标题优先级：`custom-title` > `ai-title` > 首条 user 文本（`getFirstUserMessage`，截断 80 字）。
- **图片**：user 块里 `type==="image"` 的 base64 不进消息体，只产出 `images: [{id, mediaType}]`，按需通过 `getImage` 流式取出（见 §3 ④）。

**`trae.ts`**：处理 `~/.trae/cli/sessions/YYYY/MM/DD/rollout-*.jsonl`。
- 文件首行是 `session_meta`，其 `payload.cwd` 即对应 project；用与 claude 同样的 `-Users-xxx-foo` 编码作 dirName，方便统一 URL 形态。
- 事件格式 `{timestamp, type, payload}`：`response_item.payload.type === "message"` 转 user/assistant，`function_call` + `function_call_output` 按 `call_id` 配对成 toolCall。
- 过滤开头注入的"Today's date is …"等系统文本，让首句标题真实反映用户问题。
- 5s 索引缓存：扫描所有 rollout 文件按 cwd 聚合，避免每次 REST 都重新 walk 整个目录树。

**`codex.ts`**：处理 `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl`。
- 目录结构与 rollout 事件格式和 TRAE 同源，但独立实现，避免改动已稳定的 TRAE source。
- 只渲染 `response_item` 中的 `message`（user/assistant）和 `function_call`；跳过 `event_msg` 的重复消息、`developer` 注入指令、`reasoning` 加密块与 token 统计。
- user 消息里的 `input_image` data URI 不直接进入消息体，只生成 `{id, mediaType}` 引用，并通过 `getImage` 按需解码流式返回。
- 5s 索引缓存：扫描所有 rollout 文件按 cwd 聚合，避免每次 REST 都重新 walk 整个目录树。

### 4.2 parser.ts —— 通用 helpers

不再是单一解析器，而是供 sources 复用的工具：

| 导出 | 作用 |
|------|------|
| `ParsedMessage` 类型 | 跨 source 统一的消息形状（含 `images?: ImageRef[]` 与 `toolCalls?`） |
| `ImageRef` | `{id, mediaType}` 轻量引用，不带 base64 |
| `stripSystemTags(text)` | 剥离 `<system-reminder>` / `<local-command-*>` / `<command-*>` / `<bridge_context>` / `<permissions instructions>` 等系统标签 |
| `extractText(content)` | 从字符串或 block 数组提取纯文本（同时识别 claude `text`、trae `input_text`/`output_text`） |
| `mergeMessages(raw)` | 合并连续同角色消息（拼接文本、合并 toolCalls 与 images），剔除空消息 |

> ⚠️ **增量解析的已知约束**：每个 source 的 `parseNewBytes` 只在当前字节块内配对工具结果。若某个 `tool_use` 的 `tool_result` 落在后续块，结果会暂时缺失（`result=undefined`），直到切换标签页触发全量 `parseSession` 重新配对补齐。

### 4.3 routes —— REST 接口

| 方法 & 路径 | 说明 | 返回 |
|-------------|------|------|
| `GET /api/clis` | 本机检测到的 CLI 列表 | `[{id, label}]` |
| `GET /api/projects?cli=` | 列出所有有会话的项目 | `Project[]` |
| `GET /api/sessions/recent?cli=&limit=` | 全局最近 N 个会话（默认 5，封顶 200） | `SessionInfo[]` |
| `GET /api/sessions/search?cli=&q=` | 按路径名或会话标题搜索 | `SessionInfo[]` |
| `GET /api/sessions/:project?cli=` | 某项目下所有会话 | `SessionInfo[]` |
| `GET /api/sessions/:project/:sessionId?cli=` | 单个会话的完整消息（无分页参数时返回数组） | `Message[]` |
| `GET /api/sessions/:project/:sessionId?cli=&recentRounds=N` | 最近 N 轮 | `SessionPage` |
| `GET /api/sessions/:project/:sessionId?cli=&beforeRound=K&rounds=N` | 早于第 K 轮的 N 轮 | `SessionPage` |
| `DELETE /api/sessions/:project/:sessionId?cli=` | **真删** 本地 jsonl（TRAE 同时删 `*.artifacts/`），404 表示文件不存在 | `{ok:true}` |
| `GET /api/image/:project/:sessionId/:imageId?cli=claude|codex` | 单张图片字节流（按需，带 `Cache-Control`） | image/png \| image/jpeg |

`SessionPage = {messages, totalRounds, oldestLoadedRound, hasMore}`。**不传分页参数时维持旧行为**（直接返回数组），向后兼容老代码与第三方调用。

> ⚠️ **路由注册顺序**：`/recent` 和 `/search` 必须注册在 `/:project` **之前**，否则 Express 会把 `recent`/`search` 当成项目名。改 `sessions.ts` 时注意这点。

### 4.4 watcher.ts —— 实时监听

- 每个 WebSocket 客户端维护一份 `WatchState`（监听的文件路径、当前字节偏移、cli id、chokidar watcher 实例）。
- `handleWatch(ws, cli, project, session)` 通过 `getSource(cli).resolveSessionFile` 拿到文件路径后启动监听；初始 offset = 当前文件大小（只推后续新增）。
- 文件 `change` 事件触发对应 source 的 `parseNewBytes`，把新消息通过 WS 推给该客户端，并前移 offset。
- `awaitWriteFinish` 防抖（200ms），避免半行写入被解析。
- 一个客户端同时只监听一个文件，`handleWatch` 会先 `stopWatch` 清掉旧的（也是切换 CLI / 切换 tab 时复用的清理路径）。

### 4.5 index.ts —— 服务组装

- Express 挂载 `/api/clis`、`/api/projects`、`/api/sessions`、`/api/image` 路由；生产模式下静态托管 `dist/`（含 favicon），并对非 API 路由回退 `index.html`（SPA）。
- 在同一个 HTTP server 上挂 WebSocketServer（path `/ws`），消息类型：`watch`（带 cli/project/session）/ `unwatch`。
- `findOpenPort` 从 `PORT`（默认 3456）起递增找空闲端口。
- 启动后默认用系统命令自动打开浏览器（`open`/`start`/`xdg-open`）；调试时可设 `CC_READER_OPEN=0` 禁用自动打开，避免抢占现有浏览器窗口。
- 启动前检查 `~/.claude` 与 `~/.trae/cli/sessions` **至少一个存在**，否则报错退出。

---

## 5. 前端详解

### 5.1 状态中枢 App.tsx

`App` 持有所有顶层状态，是数据流的汇聚点：

- **`tabs: TabData[]` + `activeTabId`** —— 多标签页。每个 `TabData` 含 `cli/project/session/messages/totalRounds/oldestLoadedRound/hasMore/loadingMore`，跨 CLI 时正确路由 watch 与图片 URL。
- **`cli` / `useCli`** —— 当前 CLI（claude/trae/codex），localStorage 持久化。切 CLI 时 `handleSelectCli` 清掉所有 tabs（不同 CLI 的 session id 不通用）。
- **`favorites` / `useFavorites(cli)`** —— 收藏列表（按 CLI 隔离）。透到 Sidebar 用于顶部 Favorites 区与每条 SessionItem 的星标。
- **打开会话 `handleOpenTab`**：已打开则激活；否则 `fetch(...?cli=&recentRounds=10)` 拿 `SessionPage` 建新标签页，存好 `oldestLoadedRound/hasMore`。
- **加载更早 `handleLoadMore`**：`fetch(...?cli=&beforeRound=N&rounds=10)` → 把更老消息 prepend 到当前 tab，更新 `oldestLoadedRound/hasMore`。绑到 QuestionNav 顶部按钮。
- **接收实时消息 `handleNewMessages`**：WebSocket 推来的新消息 append 到**当前活动**标签页（用 `activeTabIdRef` 避免闭包过期）。
- **派生数据**（`useMemo`）：问题列表 `questions`（带 `oldestLoadedRound` 偏移得到绝对轮号）、用户提问序号映射 `userQuestionIndices`、已打开会话 id 集合 `openSessionIds`。

布局：`Sidebar`（左，含 CLI 切换 + Favorites + Recent + 项目树）│ `TabBar` + `Toolbar` + `MessageList`（中）│ `QuestionNav`（右，含"加载更早"按钮）。

### 5.2 渲染管线

```
MessageList            滚动容器；新消息时若用户在底部则自动滚到底
  ├─ UserMessage       用户消息（左边框强调样式，带提问序号 #n）
  │     ├─ MarkdownContent   正文
  │     └─ <img loading="lazy" src="/api/image/...">  粘贴的图片（按需加载，可点开原图）
  └─ AssistantMessage  Claude 消息（卡片样式，含 model 标签）
        ├─ MarkdownContent   Markdown 正文渲染
        └─ ToolCallBlock     工具调用（可折叠，显示 Input / Output）
```

**MarkdownContent** 是渲染核心，组合了一条 react-markdown 管线：

- `remarkGfm` —— 表格、删除线等 GitHub 风格扩展
- `remarkMath` + `rehypeKatex` —— LaTeX 公式（`$...$` / `$$...$$`）
- 自定义 `code` 组件：带语言的代码块走 `react-syntax-highlighter`（Prism），明暗主题由 `useIsDark` 决定用 `oneDark`/`oneLight`；无语言的多行代码走简易 `<pre>`；行内代码走 `<code>` 样式
- 渲染前先经 `unwrapInlineMath` 预处理（见 §7）

**图片渲染**：仅当 `message.images` 非空时显示。`UserMessage` 接收 `cli/project/sessionId` props 来构造 `/api/image/...` URL，并用 `loading="lazy"` 让浏览器在滚动到时才发请求。

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
| `useCli` | 当前 CLI（claude/trae/codex）+ localStorage 持久化，切换时由 App 负责清 tabs |
| `useFavorites(cli)` | 当前 CLI 的收藏列表（localStorage key `ccreader.favorites.<cli>`），暴露 `favorites/isFavorite/toggle/remove`（`remove` 用于删除会话时同步清理收藏） |
| `useShowTools` | "是否展示工具调用输出"开关（localStorage `ccreader.showTools`）；`MessageList` 据此跳过纯工具调用的消息，`AssistantMessage` 据此屏蔽行内的 `ToolCallBlock` |
| `useReadingWidth` | 阅读区最大宽度档位（`narrow` 720 / `normal` 896 / `wide` 1200 / `full` 不限），localStorage key `ccreader.readingWidth`；导出 `maxWidth` 字符串供 `MessageList` 外层 `style` 使用 |
| `useWebSocket` | WS 连接、自动重连（指数退避，上限 30s）、`watch(cli, project, session)`/`unwatch`、连接状态 |
| `useScrollTo` | 按消息 uuid 平滑滚动并短暂高亮（QuestionNav 跳转用） |

---

## 6. 类型契约

所有跨层类型定义在 `src/types/message.ts`，与后端 `parser.ts` 的 `ParsedMessage` 对应：

- `CliId` —— `"claude" | "trae" | "codex"`，所有 REST/WS 都按此路由
- `CliOption` —— `/api/clis` 返回的项 `{id, label}`
- `Project` —— 项目（`name` 显示名 / `dirName` 目录名 / `sessionCount`）
- `SessionInfo` —— 会话条目（`id` / `firstMessage` 标题 / `timestamp` / `messageCount` / 可选 `project`）
- `ImageRef` —— `{id: "<msgUuid>:<idx>", mediaType}`，由后端附在 user 消息上，前端用来构 `/api/image/...` URL
- `Message` —— 一条消息（`type` user/assistant / `content` / 可选 `toolCalls` / `model` / `images?: ImageRef[]`）
- `ToolCall` —— 工具调用（`name` / `input` / 可选 `result` / `isError`）
- `SessionPage` —— 分页响应 `{messages, totalRounds, oldestLoadedRound, hasMore}`
- `TabData` —— 标签页（`cli/project/session/messages` + 分页状态 `totalRounds/oldestLoadedRound/hasMore/loadingMore`）
- `WsMessage` —— WebSocket 消息信封（`watch` 时带 `cli/project/session`）

> 后端返回的字段名需与这些类型保持一致。改后端返回结构时，同步更新这里。

---

## 7. 关键设计决策

- **后端不编译，tsx 直跑**：简化部署，`npm start` 只构建前端。`tsconfig.server.json` 仅用于类型检查/可选编译。
- **CliSource 抽象**：每个 CLI 独立实现，`getSource(?cli=)` 路由；新增 CLI 只需补一份 source（实现 listProjects/parseSession/parseNewBytes 等接口），路由层无需改动。
- **图片不入消息体，按需流式**：base64 整张可达 1MB+，inline 进会话 JSON 会让网络/JSON 反序列化卡住。改成 `{id, mediaType}` 引用 + 独立 endpoint 后，浏览器自带 HTTP 缓存，滚到时才拉。
- **轮分页**：长会话（千轮级）首屏只渲染 10 轮，避免 React 全量渲染卡顿。"轮"= 一次用户提问到下一次提问之间的所有消息；按 user 文本边界切片，避开 `mergeMessages` 后的合并块复杂度。`oldestLoadedRound` 兼任游标和绝对编号偏移（QuestionNav 序号始终是绝对值）。
- **收藏夹按 CLI 隔离**：localStorage key 用 `ccreader.favorites.<cli>`，切 CLI 时重读对应键，互不干扰。
- **工具调用"接断线"**：`tool_use` 与 `tool_result` 在 JSONL 中分离，靠 `buildToolResultMap` 按 id 配对——理解工具结果显示必须抓住这点。
- **连续同角色合并**：Claude 的一次回复可能拆成多条 JSONL 记录，`mergeMessages` 合并它们，让 UI 呈现为单条消息（同时合并 toolCalls 与 images）。
- **系统标签双端剥离**：`stripSystemTags` 在后端（parser）和前端（parseContent）各有一份，确保无论哪条通路进来的文本都干净。两处规则需保持同步。
- **CSS 变量 + 语义色**：组件不写死颜色，所以新增主题只需加一套变量，零改组件。
- **公式反引号解包 `unwrapInlineMath`**：有些公式被 ``` `$...$` ``` 反引号包住，会被当成行内代码而非公式。此函数在渲染前把"整体就是一段 `$...$`"的反引号解开交给数学插件，同时跳过 ``` ``` 围栏代码块避免误伤 shell 代码。
- **增量解析的偏移管理**：watcher 按字节 offset 增量读，省去每次全量解析；代价是跨块的工具结果需全量重载补齐（见 §4.2 约束）。

---

## 8. 二次开发指引：想改 X 去哪里

| 需求 | 改这里 |
|------|--------|
| 新增/调整主题配色 | `src/index.css`（加一套 `[data-theme=...]` 变量）+ `useTheme.ts`（Theme 类型与列表）+ `Toolbar.tsx`（选择器选项） |
| 新增 CLI 数据源 | `server/sources/<new>.ts` 实现 `CliSource` + `server/sources/types.ts` 的 `CliSource.id` + `server/sources/index.ts` 注册表 + `server/index.ts` 的 `/api/clis` label/启动检查 + `src/types/message.ts` 加 `CliId` + `src/hooks/useCli.ts` 持久化校验 + `Sidebar.tsx` 的 `CLI_LABELS` |
| 改某个工具调用的摘要显示 | `src/utils/parseContent.ts` 的 `getToolSummary` |
| 工具调用的展开/输出 UI | `src/components/ToolCallBlock.tsx` |
| Markdown/代码/表格/链接渲染 | `src/components/MarkdownContent.tsx` |
| 新增系统标签的剥离规则 | `server/parser.ts` 和 `src/utils/parseContent.ts` 的 `stripSystemTags`（**两处都要改**） |
| 会话标题的取法 | 对应 source 的 `getSessionTitle` / `parseFirstUserText`（`server/sources/claude.ts` / `trae.ts`） |
| 新增 REST 接口 | `server/routes/`（注意 `sessions.ts` 的路由顺序，静态段在 `/:param` 之前） |
| 实时推送逻辑 / 监听策略 | `server/watcher.ts` |
| 侧栏搜索/分页/树展示 | `src/components/Sidebar.tsx` + `routes/sessions.ts` 的 `/search` |
| 收藏夹存储/排序 | `src/hooks/useFavorites.ts`（store 形状 + key 命名） |
| 收藏入口星标样式 / 删除按钮 / inline 确认 | `src/components/SessionItem.tsx` |
| 删除会话（真删本地文件） | 后端 `server/sources/{claude,trae}.ts` 的 `deleteSession` + `server/routes/sessions.ts` 的 `DELETE /:project/:sessionId` + 前端 `App.tsx` 的 `handleDeleteSession` |
| Recent 显示条数 / 加载更多 | `src/components/Sidebar.tsx` 的 `RECENT_INITIAL` / `loadMoreRecent` + `server/routes/sessions.ts` `/recent?limit=` |
| 工具调用输出显隐开关 | `src/hooks/useShowTools.ts`（localStorage `ccreader.showTools`）+ `Toolbar.tsx` 眼睛按钮 + `MessageList.tsx` / `AssistantMessage.tsx` 过滤逻辑 |
| 阅读区宽度档位 | `src/hooks/useReadingWidth.ts`（4 档预设：narrow/normal/wide/full，localStorage `ccreader.readingWidth`）+ `Toolbar.tsx` 宽度选择器 + `MessageList.tsx` 外层 `style={{ maxWidth }}` |
| 字号范围/快捷键 | `src/hooks/useFontSize.ts` |
| 消息卡片样式（用户/Claude） | `src/components/UserMessage.tsx` / `AssistantMessage.tsx` |
| 图片渲染（懒加载/尺寸/点开行为） | `src/components/UserMessage.tsx` 的 `<img>` 块 + `server/routes/images.ts` |
| 标签页行为 | `src/components/TabBar.tsx` + `App.tsx` 的 tab 状态逻辑 |
| 问题导航 / "加载更早 N 轮"按钮 | `src/components/QuestionNav.tsx` + `App.tsx` 的 `handleLoadMore` |
| 每次加载多少轮（默认 10） | `src/App.tsx` 顶部的 `ROUNDS_PER_PAGE` |
| 默认端口 / 启动行为 | `server/index.ts`（`PORT` / `CC_READER_OPEN` 环境变量、`findOpenPort`、开浏览器命令） |
| 站点图标 | `public/favicon.svg` + `index.html` 的 `<link rel="icon">` |
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
