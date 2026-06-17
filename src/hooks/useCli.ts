import { useEffect, useState } from "react";
import type { CliId } from "../types/message";

const STORAGE_KEY = "ccreader.cli";

function readStored(): CliId {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "claude" || v === "trae") return v;
  } catch {
    // ignore
  }
  return "claude";
}

export function useCli() {
  const [cli, setCliState] = useState<CliId>(readStored);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, cli);
    } catch {
      // ignore
    }
  }, [cli]);

  return { cli, setCli: setCliState };
}
