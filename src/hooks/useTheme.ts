import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "cc-reader-theme";

type Theme = "light" | "dark";

function getInitial(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch { /* ignore */ }
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch { /* ignore */ }
  return "light";
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitial);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch { /* ignore */ }
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }, []);

  return { theme, isDark: theme === "dark", toggle };
}
