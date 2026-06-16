# cc-reader 界面灵动化改造设计

日期：2026-06-16
状态：已与用户确认，待实现

## 背景与目标

cc-reader 当前是一个 Claude Code 对话查看器（React + Vite + Tailwind），界面为典型 IDE 工具风：纯亮色、等宽字体、灰白配色、三栏布局，几乎只有颜色过渡、无真正动画、无暗色模式。

用户希望「界面更灵动优美」。经头脑风暴（含可视化预览）确认，本次改造包含**七块**内容，核心原则是**最小幅度、不破坏现有良好体验、保持信息密度**。

## 风格方向（已确认）

用户从 4 个风格方向中选定 A + B，做成**一对可切换的明暗主题**：

- **亮色主题 = 精致亮色**：柔和阴影、更大圆角、蓝紫强调（`#6366f1`）、微妙浮起动效。
- **暗色主题 = 暗色玻璃**：深色背景（`#0f1117`）、毛玻璃半透明、霓虹青强调（`#22d3ee`）、发光指示。

切换方式：顶栏一个滑动开关；**默认跟随系统**明暗偏好；手动切换后写入 `localStorage` 记住选择。

## 七块改造内容

### 一、主题系统（地基）

当前组件到处写死颜色（`bg-white`、`text-gray-600`…），无法直接切主题。做法：

1. 在 `src/index.css` 定义 `:root`（亮色）和 `.dark`（暗色）两套 CSS 变量，承载预览中确认的两套配色。
2. 在 `tailwind.config.js` 的 `theme.extend.colors` 把这些变量注册成语义色（如 `base`、`surface`、`side`、`border`、`primary`、`dim`、`accent`、`accent-soft`、`sel-bg`、`sel-text`），组件里把写死颜色替换为语义类。这是**机械替换、低风险，但扫过几乎所有组件**——暗色主题不可避免的成本。
3. `darkMode: "class"` 模式，暗色通过根元素 `.dark` class 控制。
4. 新增 `src/hooks/useTheme.ts`：读取/写入 `localStorage`，未设置时回落到 `prefers-color-scheme`，切换时增删根元素 `.dark` class。
5. `index.html` 加内联脚本，在 React 加载前就设好主题 class，**避免刷新白闪**。

### 二、四个动画

| 动画 | 落点 |
|---|---|
| 消息淡入上滑 | `MessageList` 每条消息进场（`@keyframes` fade + translateY） |
| 工具块平滑展开 | `ToolCallBlock` 展开/折叠（max-height 过渡）+ 侧栏折叠 |
| hover 微浮起 | 侧栏项、Tab、按钮、卡片（transform + shadow transition） |
| 主题切换渐变 | 根容器 `background`/`color` 0.5s 过渡 |

所有动画定义在 CSS，并用 `@media (prefers-reduced-motion: reduce)` 尊重无障碍设置。

### 三、侧栏选中态（用户专门强调）

`SessionItem` 与 Recent 列表的选中项：

- **强调色滑动指示条**：左侧一条 3px 强调色竖条，点不同会话时平滑滑动过去，带轻微回弹（`cubic-bezier(.34,1.3,.5,1)`）。
- 选中项背景高亮（`sel-bg`）+ 文字变强调色（`sel-text`）。
- 暗色模式下指示条发光（`box-shadow`）。
- hover 时项目轻微右移 + 背景微亮。

实现注意：指示条用绝对定位 + `top` 过渡。需要一个容器内的「当前选中项纵向偏移」状态来驱动。若纯 CSS 难以跨独立 SessionItem 协调，可在 Sidebar 层维护选中项的 ref/offset。

### 四、工具调用接入（最小幅度）

当前状态：后端 `parser.ts` 已提取 `toolCalls`，前端 `ToolCallBlock.tsx` 折叠块已写好，但 `AssistantMessage.tsx` **从未调用**——所以工具调用在界面完全不显示。本质是「接上断线」。

1. **前端 `AssistantMessage`**：在文本下方渲染 `message.toolCalls` 列表（复用 `ToolCallBlock`，默认折叠）。
2. **前端**：放宽「空文本就跳过」判断——只有工具调用、无文字的 assistant 消息也要显示。
3. **后端 `parser.ts`**：
   - `mergeMessages` 合并多轮的 `toolCalls`（否则一个回合多次工具调用只显示第一批）。
   - 末尾「纯文本为空就过滤」放宽：有 `toolCalls` 的消息不被丢弃。

### 五、工具输出结果（可折叠）

- 数据配对：`tool_result` 出现在**下一条 user 消息**里，通过 `tool_use_id` 关联对应的 `tool_use`。后端 `parser.ts` 解析时建立 `tool_use_id → result` 映射，把 result 附到对应工具调用上。
- `tool_result` 的 `content` 实测为 **string 或 array**（数组元素含 text 等类型），需兼容两种。也可能带 `is_error`。
- `ToolCallBlock` 折叠块展开后：**上半**显示调用参数（已有），**下半**新增显示对应输出。整块默认折叠，点击平滑展开/收起。
- 输出可能很长：折叠区做**最大高度 + 内部滚动**，不撑爆页面。

### 六、公式渲染（KaTeX）

用户确认：这是纯阅读器，复制源码可去 TUI，此处只追求好看 → **渲染范围最大化**。

- 引入 `remark-math` + `rehype-katex` + `katex` CSS，接到现有 `react-markdown` 管线。
- 实测公式有两种形态：裸 `$...$` / `$$...$$`（可直接渲染），以及**被反引号包成行内代码的** `` `$...$` ``（截图中灰底的那些）。
- **关键预处理**：喂给 Markdown 前，用正则把「反引号包裹且内部为 `$...$`」的片段**解包**成裸 `$...$`，让数学插件接管。正则需精确匹配，不误伤普通行内代码（如 `` `npm install` ``）。
- 暗色主题下调整 KaTeX 颜色跟随文字色。

### 七、整体样式换肤

所有组件从写死颜色迁移到语义色，使其同时适配亮/暗主题。涉及：`App`、`Sidebar`、`SessionItem`、`Toolbar`、`TabBar`、`QuestionNav`、`UserMessage`、`AssistantMessage`、`ToolCallBlock`、`MarkdownContent`。

## 改动文件清单

**新增依赖**：`remark-math`、`rehype-katex`、`katex`

**新增文件**：
- `src/hooks/useTheme.ts` — 主题状态 hook

**改动 — 配置/样式地基**：
- `tailwind.config.js` — `darkMode: "class"` + 语义色扩展
- `src/index.css` — 亮/暗 CSS 变量、动画 keyframes、prefers-reduced-motion、KaTeX 暗色微调
- `index.html` — 防白闪内联脚本

**改动 — 逻辑**：
- `server/parser.ts` — 合并多轮 `toolCalls`、配对 `tool_result`、放宽纯工具消息过滤
- `src/types/message.ts` — `ToolCall` 增加 `result` 字段（及类型）
- `src/components/AssistantMessage.tsx` — 渲染工具调用、放宽空文本跳过
- `src/components/MarkdownContent.tsx` — 接数学插件 + 反引号解包预处理
- `src/components/ToolCallBlock.tsx` — 显示输出、折叠动画、主题样式
- `src/utils/parseContent.ts` — 工具调用/结果相关辅助（按需）

**改动 — 换肤**：
- `App`、`Sidebar`、`SessionItem`、`Toolbar`、`TabBar`、`QuestionNav`、`UserMessage` — 语义色 + 动画类

## 明确不做（YAGNI / 保持最小）

- 不新增第三、第四套主题（只做亮/暗两套）。
- 不做超出四个的动画（不加页面转场、不加花哨粒子等）。
- 工具调用不默认展开（保持当前清爽的信息密度）。
- 不改动现有三栏布局结构、不改 WebSocket/数据流架构。

## 风险与注意点

- **换肤是大面积机械改动**：逐组件替换颜色类，需保证不遗漏、不改变布局。
- **侧栏滑动指示条**：跨独立 `SessionItem` 协调选中偏移，可能需要在 Sidebar 层管理，注意 Recent 与项目树两个列表各自独立。
- **反引号解包正则**：必须精确，避免把普通代码（`` `$HOME` `` 这类 shell 变量）误渲染——虽然用户接受「极少数误伤」，仍应尽量收窄。
- **tool_result 配对**：注意一条 user 消息可能含多个 tool_result；`mergeMessages` 合并 user 文本时不能丢掉 tool_result 信息。
- **KaTeX CSS 体积**：引入 katex 样式表，确认打包正常。
