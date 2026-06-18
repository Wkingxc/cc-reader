import { useCallback, useEffect, useState } from "react";
import type { CliId, SessionInfo } from "../types/message";

export interface FavoriteEntry {
  id: string;
  project: string;
  firstMessage: string;
  timestamp: string;
  messageCount: number;
  favoritedAt: string;
}

const KEY_PREFIX = "ccreader.favorites.";

function read(cli: CliId): FavoriteEntry[] {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + cli);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter(
      (e) =>
        e &&
        typeof e.id === "string" &&
        typeof e.project === "string"
    );
  } catch {
    return [];
  }
}

function write(cli: CliId, list: FavoriteEntry[]): void {
  try {
    localStorage.setItem(KEY_PREFIX + cli, JSON.stringify(list));
  } catch {
    // quota / disabled — ignore silently
  }
}

export function useFavorites(cli: CliId) {
  const [favorites, setFavorites] = useState<FavoriteEntry[]>(() => read(cli));

  useEffect(() => {
    setFavorites(read(cli));
  }, [cli]);

  const isFavorite = useCallback(
    (id: string, project?: string) =>
      favorites.some((f) => f.id === id && (!project || f.project === project)),
    [favorites]
  );

  const toggle = useCallback(
    (project: string, session: SessionInfo) => {
      setFavorites((prev) => {
        const existing = prev.find(
          (f) => f.id === session.id && f.project === project
        );
        const next = existing
          ? prev.filter((f) => !(f.id === session.id && f.project === project))
          : [
              ...prev,
              {
                id: session.id,
                project,
                firstMessage: session.firstMessage,
                timestamp: session.timestamp,
                messageCount: session.messageCount,
                favoritedAt: new Date().toISOString(),
              },
            ];
        write(cli, next);
        return next;
      });
    },
    [cli]
  );

  const remove = useCallback(
    (project: string, id: string) => {
      setFavorites((prev) => {
        if (!prev.some((f) => f.id === id && f.project === project)) return prev;
        const next = prev.filter((f) => !(f.id === id && f.project === project));
        write(cli, next);
        return next;
      });
    },
    [cli]
  );

  return { favorites, isFavorite, toggle, remove };
}
