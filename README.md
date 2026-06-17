# CC Reader

CLI 对话历史本地查看器。支持 **Claude Code**（`~/.claude/projects/`）和 **TRAE CLI**（`~/.trae/cli/sessions/`）—— 把枯燥的 JSONL 日志变成浏览器里可以舒适阅读的对话界面。

> 纯本地运行，不上传任何数据，不需要联网，不需要 API Key。

---

## ✨ 功能一览

| 功能 | 说明 |
|------|------|
| **多 CLI 切换** | 左上角下拉切换 Claude Code / TRAE CLI，状态独立 |
| **Markdown 渲染** | 代码块语法高亮、表格、链接、引用块完整支持 |
| **LaTeX 公式** | 通过 KaTeX 渲染行内与块级数学公式 |
| **图片显示** | Claude 会话里粘贴的图片自动渲染（按需流式加载，可点开原图） |
| **工具调用展示** | 可折叠查看 Read / Bash / Edit / Write 等工具的输入参数与输出结果 |
| **三主题切换** | 浅紫 / 浅蓝 / 暗色，顶栏弹出式选择器一键切换，平滑过渡，刷新后保持选择 |
| **收藏夹** | 侧栏 Favorites 分组，星标快速收藏对话，按 CLI 隔离持久化 |
| **会话搜索** | 侧栏按路径或对话标题实时搜索，自动过滤并展开匹配项 |
| **轮分页** | 长会话首屏只加载最近 10 轮，右侧"加载更早 10 轮"按需向上扩展，避免卡顿 |
| **实时更新** | 正在进行的对话会自动追加新消息（基于文件监听 + WebSocket） |
| **多标签页** | 同时打开多个会话，像浏览器一样切换 |
| **问题快速跳转** | 右侧浮动面板，一键跳到任意一轮提问 |
| **字体大小调节** | 工具栏按钮或 `Ctrl/Cmd` + `+`/`-`，设置自动保存 |
| **灵动动画** | 消息淡入、侧栏选中态指示条、连接状态呼吸灯，并尊重「减少动效」无障碍设置 |

### 键盘快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl/Cmd` + `=` | 放大字体 |
| `Ctrl/Cmd` + `-` | 缩小字体 |

---

## 📦 安装与运行

### 环境要求

- **Node.js** 18 或更高（`node -v` 查看）
- **Claude Code** 或 **TRAE CLI**（至少一个）—— 对话历史分别存储在 `~/.claude/projects/` 与 `~/.trae/cli/sessions/`
- 支持 macOS / Linux / Windows

### 安装

```bash
git clone https://github.com/Wkingxc/cc-reader.git
cd cc-reader
npm install
```

### 启动

```bash
npm start
```

这一条命令会自动完成 **构建前端 → 启动服务 → 打开浏览器**。终端会打印实际地址：

```
CC Reader running at http://localhost:3456
```

浏览器会自动弹出该地址；若没有自动打开，手动复制到浏览器即可。左侧选一个会话即可开始阅读。

> 端口 3456 被占用时会自动顺延到下一个空闲端口（以终端打印为准），也可手动指定：`PORT=8080 npm start`。

> 本工具读取的是当前用户主目录下的私密对话记录，默认只监听 `localhost`，请勿直接暴露到公网。如需远程使用，建议通过 SSH 端口转发（`ssh -L 3456:localhost:3456 user@host`）访问。

---

## 🛠 开发模式

获得前端热更新 + 后端自动重启：

```bash
npm run dev
```

- 前端 dev server：`http://localhost:5173`（含热更新，开发时访问这个）
- 后端 API：`http://localhost:3456`（前端通过 Vite 代理转发 `/api` 与 `/ws`）

### 可用脚本

| 命令 | 作用 |
|------|------|
| `npm start` | 构建前端并启动服务（生产模式，单端口同时提供 API 与页面） |
| `npm run dev` | 前端热更新 + 后端自动重启（开发模式） |
| `npm run build` | 仅构建前端到 `dist/` |
| `npm run server` | 仅启动后端服务（需先 `npm run build`） |

**技术栈**：React 18 · Vite · Tailwind CSS 3 · TypeScript · Express · ws · chokidar · KaTeX
