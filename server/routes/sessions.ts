import { Router } from "express";
import { getSource } from "../sources/index.js";

const router = Router();

router.get("/recent", (req, res) => {
  const source = getSource(req.query.cli as string | undefined);
  res.json(source.recentSessions(5));
});

router.get("/search", (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) {
    res.json([]);
    return;
  }
  const source = getSource(req.query.cli as string | undefined);
  res.json(source.searchSessions(q));
});

router.get("/:project", (req, res) => {
  const source = getSource(req.query.cli as string | undefined);
  const list = source.listSessions(req.params.project);
  if (list.length === 0) {
    // For trae, an empty list may be valid (e.g. cwd never used). For claude
    // we previously 404'd on missing dir; tolerate both for simplicity.
    res.json([]);
    return;
  }
  res.json(list);
});

router.get("/:project/:sessionId", (req, res) => {
  const source = getSource(req.query.cli as string | undefined);
  const messages = source.parseSession(req.params.project, req.params.sessionId);
  if (messages == null) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  res.json(messages);
});

export default router;
