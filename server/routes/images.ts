import { Router } from "express";
import { getSource } from "../sources/index.js";

const router = Router();

router.get("/:project/:sessionId/:imageId", (req, res) => {
  const source = getSource(req.query.cli as string | undefined);
  if (!source.getImage) {
    res.status(404).json({ error: "Images not supported for this CLI" });
    return;
  }

  const result = source.getImage(
    req.params.project,
    req.params.sessionId,
    req.params.imageId
  );
  if (!result) {
    res.status(404).json({ error: "Image not found" });
    return;
  }

  res.setHeader("Content-Type", result.mediaType);
  res.setHeader("Cache-Control", "private, max-age=3600");
  res.send(result.buffer);
});

export default router;
