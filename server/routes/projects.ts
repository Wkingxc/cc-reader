import { Router } from "express";
import { getSource } from "../sources/index.js";

const router = Router();

router.get("/", (req, res) => {
  const source = getSource(req.query.cli as string | undefined);
  res.json(source.listProjects());
});

export default router;
