import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "ccreader.showTools";

function read(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw == null) return true;
    return raw !== "0";
  } catch {
    return true;
  }
}

export function useShowTools() {
  const [showTools, setShowTools] = useState<boolean>(read);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, showTools ? "1" : "0");
    } catch {
      // ignore
    }
  }, [showTools]);

  const toggle = useCallback(() => setShowTools((v) => !v), []);

  return { showTools, toggle, setShowTools };
}
