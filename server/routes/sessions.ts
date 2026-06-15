import { Router } from "express";
import * as fs from "fs";
import * as path from "path";
import { getProjectsDir, parseJsonlFile, getFirstUserMessage } from "../parser.js";

const router = Router();

router.get("/:project", (req, res) => {
  const projectDir = path.join(getProjectsDir(), req.params.project);

  if (!fs.existsSync(projectDir)) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const files = fs.readdirSync(projectDir).filter((f) => f.endsWith(".jsonl"));

  const sessions = files.map((f) => {
    const filePath = path.join(projectDir, f);
    const stat = fs.statSync(filePath);
    const id = f.replace(".jsonl", "");

    let firstMessage = "(empty)";
    let messageCount = 0;
    try {
      firstMessage = getFirstUserMessage(filePath);
      const content = fs.readFileSync(filePath, "utf-8");
      messageCount = content.split("\n").filter((l) => l.trim()).length;
    } catch {
      // skip unreadable files
    }

    return {
      id,
      firstMessage,
      timestamp: stat.mtime.toISOString(),
      messageCount,
    };
  });

  sessions.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  res.json(sessions);
});

router.get("/:project/:sessionId", (req, res) => {
  const filePath = path.join(
    getProjectsDir(),
    req.params.project,
    `${req.params.sessionId}.jsonl`
  );

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  try {
    const messages = parseJsonlFile(filePath);
    res.json(messages);
  } catch {
    res.status(500).json({ error: "Failed to parse session" });
  }
});

export default router;
