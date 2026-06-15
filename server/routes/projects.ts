import { Router } from "express";
import * as fs from "fs";
import * as path from "path";
import { getProjectsDir, parseProjectName } from "../parser.js";

const router = Router();

router.get("/", (_req, res) => {
  const projectsDir = getProjectsDir();

  if (!fs.existsSync(projectsDir)) {
    res.json([]);
    return;
  }

  const entries = fs.readdirSync(projectsDir, { withFileTypes: true });
  const projects = entries
    .filter((e) => e.isDirectory())
    .map((e) => {
      const dirPath = path.join(projectsDir, e.name);
      const sessions = fs
        .readdirSync(dirPath)
        .filter((f) => f.endsWith(".jsonl"));
      return {
        name: parseProjectName(e.name),
        dirName: e.name,
        path: dirPath,
        sessionCount: sessions.length,
      };
    })
    .filter((p) => p.sessionCount > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  res.json(projects);
});

export default router;
