import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "cc-reader-font-size";
const MIN = 12;
const MAX = 28;
const STEP = 2;
const DEFAULT = 16;

export function useFontSize() {
  const [fontSize, setFontSize] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const n = parseInt(stored, 10);
        if (n >= MIN && n <= MAX) return n;
      }
    } catch { /* ignore */ }
    return DEFAULT;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(fontSize));
    } catch { /* ignore */ }
    document.documentElement.style.setProperty("--font-size", `${fontSize}px`);
  }, [fontSize]);

  const increase = useCallback(() => {
    setFontSize((s) => Math.min(s + STEP, MAX));
  }, []);

  const decrease = useCallback(() => {
    setFontSize((s) => Math.max(s - STEP, MIN));
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        increase();
      } else if (e.key === "-") {
        e.preventDefault();
        decrease();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [increase, decrease]);

  return { fontSize, increase, decrease };
}
