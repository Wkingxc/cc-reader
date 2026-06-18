import { useCallback, useEffect, useState } from "react";

/**
 * Reading-area width presets. Stored in localStorage as a preset id so the user
 * can keep their preferred width across sessions.
 */
export type ReadingWidth = "narrow" | "normal" | "wide" | "full";

const STORAGE_KEY = "ccreader.readingWidth";

const VALID: ReadingWidth[] = ["narrow", "normal", "wide", "full"];

// Pixel cap per preset. "full" returns null and the caller should let the
// container span the full available width.
const PX: Record<ReadingWidth, number | null> = {
  narrow: 720,
  normal: 896, // matches the previous max-w-4xl (~56rem)
  wide: 1200,
  full: null,
};

function read(): ReadingWidth {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && (VALID as string[]).includes(raw)) return raw as ReadingWidth;
  } catch {
    /* ignore */
  }
  return "normal";
}

export function useReadingWidth() {
  const [width, setWidthState] = useState<ReadingWidth>(read);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, width);
    } catch {
      /* ignore */
    }
  }, [width]);

  const setWidth = useCallback((next: ReadingWidth) => setWidthState(next), []);

  // Resolved CSS max-width string ("none" for full).
  const maxWidth = PX[width] == null ? "none" : `${PX[width]}px`;

  return { width, setWidth, maxWidth };
}
