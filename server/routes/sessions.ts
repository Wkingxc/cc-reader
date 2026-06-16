import { Router } from "express";
import * as fs from "fs";
import * as path from "path";
import { getProjectsDir, parseJsonlFile, getSessionTitle, parseProjectName } from "../parser.js";

const router = Router();

router.get("/recent", (_req, res) => {
  const projectsDir = getProjectsDir();
  if (!fs.existsSync(projectsDir)) {
    res.json([]);
    return;
  }

  const allSessions: Array<{
    id: string;
    firstMessage: string;
    timestamp: string;
    messageCount: number;
    project: string;
  }> = [];

  const entries = fs.readdirSync(projectsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const projectDir = path.join(projectsDir, entry.name);
    const files = fs.readdirSync(projectDir).filter((f) => f.endsWith(".jsonl"));

    for (const f of files) {
      const filePath = path.join(projectDir, f);
      try {
        const stat = fs.statSync(filePath);
        const id = f.replace(".jsonl", "");
        const firstMessage = getSessionTitle(filePath);
        const content = fs.readFileSync(filePath, "utf-8");
        const messageCount = content.split("\n").filter((l) => l.trim()).length;
        allSessions.push({
          id,
          firstMessage,
          timestamp: stat.mtime.toISOString(),
          messageCount,
          project: entry.name,
        });
      } catch {
        // skip unreadable files
      }
    }
  }

  allSessions.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  res.json(allSessions.slice(0, 5));
});

// NOTE: must be registered before "/:project" so Express does not treat
// "search" as a project name.
router.get("/search", (req, res) => {
  const q = String(req.query.q || "").trim().toLowerCase();
  if (!q) {
    res.json([]);
    return;
  }

  const projectsDir = getProjectsDir();
  if (!fs.existsSync(projectsDir)) {
    res.json([]);
    return;
  }

  const results: Array<{
    id: string;
    firstMessage: string;
    timestamp: string;
    messageCount: number;
    project: string;
  }> = [];

  const entries = fs.readdirSync(projectsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const pathMatches = parseProjectName(entry.name).toLowerCase().includes(q);

    const projectDir = path.join(projectsDir, entry.name);
    const files = fs.readdirSync(projectDir).filter((f) => f.endsWith(".jsonl"));

    for (const f of files) {
      const filePath = path.join(projectDir, f);
      try {
        const title = getSessionTitle(filePath);
        if (!pathMatches && !title.toLowerCase().includes(q)) continue;

        const stat = fs.statSync(filePath);
        const content = fs.readFileSync(filePath, "utf-8");
        const messageCount = content.split("\n").filter((l) => l.trim()).length;
        results.push({
          id: f.replace(".jsonl", ""),
          firstMessage: title,
          timestamp: stat.mtime.toISOString(),
          messageCount,
          project: entry.name,
        });
      } catch {
        // skip unreadable files
      }
    }
  }

  results.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  res.json(results);
});

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
      firstMessage = getSessionTitle(filePath);
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
