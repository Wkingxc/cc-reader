import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "cc-reader-theme";

export type Theme = "light" | "blue" | "dark";

export const THEMES: Theme[] = ["light", "blue", "dark"];

function normalize(value: string | null): Theme | null {
  if (value === "light" || value === "blue" || value === "dark") return value;
  return null;
}

function getInitial(): Theme {
  try {
    const stored = normalize(localStorage.getItem(STORAGE_KEY));
    if (stored) return stored;
  } catch { /* ignore */ }
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch { /* ignore */ }
  return "light";
}

// Applies the theme to <html>: a `data-theme` attribute selects the palette,
// and the legacy `.dark` class is kept in sync so existing `.dark`-scoped CSS
// (prose, katex) and the `useIsDark` hook (code highlighting) keep working.
function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.classList.toggle("dark", theme === "dark");
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getInitial);

  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch { /* ignore */ }
  }, [theme]);

  const setTheme = useCallback((next: Theme) => setThemeState(next), []);

  return { theme, isDark: theme === "dark", setTheme };
}
