import { useState, useEffect } from "react";

function getIsDarkTheme() {
  const root = document.documentElement;
  const theme = root.getAttribute("data-theme");
  return theme === "blue" || theme === "dark" || root.classList.contains("dark");
}

export function useIsDark(): boolean {
  const [isDark, setIsDark] = useState(getIsDarkTheme);

  useEffect(() => {
    const obs = new MutationObserver(() => {
      setIsDark(getIsDarkTheme());
    });
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });
    return () => obs.disconnect();
  }, []);

  return isDark;
}
