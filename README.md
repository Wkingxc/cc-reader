# CC Reader

Claude Code 对话历史本地查看器。在浏览器中舒适地阅读 AI 对话，支持 Markdown 渲染、字体调节和快速跳转。

## Features

- **Markdown 渲染** — 代码块语法高亮，表格、链接等完整支持
- **字体大小调节** — 工具栏按钮或 Ctrl/Cmd +/- 快捷键，设置自动保存
- **问题快速跳转** — 右侧浮动面板，一键跳到任意一轮提问
- **实时更新** — 正在进行的对话会自动追加新消息
- **暗色主题** — 开发者友好的深色界面
- **工具调用展示** — 可折叠查看 Read/Bash/Edit/Write 等工具调用

## Quick Start

```bash
# 安装依赖
npm install

# 启动（构建前端 + 启动服务 + 打开浏览器）
npm start
```

默认打开 http://localhost:3456。

## Development

```bash
# 开发模式（前端热更新 + 后端自动重启）
npm run dev
```

前端 dev server 在 5173 端口，API 代理到 3456 端口。

## How It Works

CC Reader 读取 `~/.claude/projects/` 下的 JSONL 对话文件：

- **Express** 后端提供 REST API 和静态文件服务
- **chokidar** 监听文件变化实现实时更新
- **WebSocket** 推送新消息到浏览器
- **React + Vite + Tailwind CSS** 前端

## Requirements

- Node.js 18+
- Claude Code（对话历史存储在 `~/.claude/projects/`）

## Keyboard Shortcuts

| 快捷键 | 功能 |
|--------|------|
| Ctrl/Cmd + = | 放大字体 |
| Ctrl/Cmd + - | 缩小字体 |
