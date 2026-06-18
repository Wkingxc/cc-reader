import { Router } from "express";
import type { ParsedMessage } from "../parser.js";
import { getSource } from "../sources/index.js";

const router = Router();

router.get("/recent", (req, res) => {
  const source = getSource(req.query.cli as string | undefined);
  const limitRaw = req.query.limit;
  let limit = 5;
  if (limitRaw != null) {
    const parsed = parseInt(String(limitRaw), 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      limit = Math.min(parsed, 200);
    }
  }
  res.json(source.recentSessions(limit));
});

router.delete("/:project/:sessionId", (req, res) => {
  const source = getSource(req.query.cli as string | undefined);
  const ok = source.deleteSession(req.params.project, req.params.sessionId);
  if (!ok) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  res.json({ ok: true });
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
    res.json([]);
    return;
  }
  res.json(list);
});

function isUserText(msg: ParsedMessage): boolean {
  if (msg.type !== "user") return false;
  const text = typeof msg.content === "string" ? msg.content.trim() : "";
  return text.length > 0;
}

// Returns 1-based round indices: round k starts at the k-th user-text message
// and includes everything up to (but not including) the next user-text message.
function findRoundStarts(messages: ParsedMessage[]): number[] {
  const starts: number[] = [];
  messages.forEach((m, i) => {
    if (isUserText(m)) starts.push(i);
  });
  return starts;
}

router.get("/:project/:sessionId", (req, res) => {
  const source = getSource(req.query.cli as string | undefined);
  const messages = source.parseSession(req.params.project, req.params.sessionId);
  if (messages == null) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const recentRoundsRaw = req.query.recentRounds;
  const beforeRoundRaw = req.query.beforeRound;
  const roundsRaw = req.query.rounds;

  // Backwards-compatible: when no pagination query is supplied, return the
  // full message array (the original shape).
  if (recentRoundsRaw == null && beforeRoundRaw == null) {
    res.json(messages);
    return;
  }

  const starts = findRoundStarts(messages);
  const totalRounds = starts.length;

  if (totalRounds === 0) {
    res.json({
      messages,
      totalRounds: 0,
      oldestLoadedRound: 0,
      hasMore: false,
    });
    return;
  }

  let fromRound: number; // 1-based, inclusive
  let toRound: number; // 1-based, inclusive

  if (beforeRoundRaw != null) {
    const before = Math.max(1, parseInt(String(beforeRoundRaw), 10) || 1);
    const count = Math.max(1, parseInt(String(roundsRaw ?? "10"), 10) || 10);
    toRound = before - 1;
    fromRound = Math.max(1, toRound - count + 1);
    if (toRound < 1) {
      res.json({
        messages: [],
        totalRounds,
        oldestLoadedRound: before,
        hasMore: false,
      });
      return;
    }
  } else {
    const recent = Math.max(1, parseInt(String(recentRoundsRaw), 10) || 10);
    fromRound = Math.max(1, totalRounds - recent + 1);
    toRound = totalRounds;
  }

  const startIdx = starts[fromRound - 1];
  const endIdx =
    toRound >= totalRounds ? messages.length : starts[toRound];
  const slice = messages.slice(startIdx, endIdx);

  res.json({
    messages: slice,
    totalRounds,
    oldestLoadedRound: fromRound,
    hasMore: fromRound > 1,
  });
});

export default router;
