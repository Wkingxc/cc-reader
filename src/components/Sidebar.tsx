import { useState, useEffect, useMemo, useRef } from "react";
import type { CliId, CliOption, Project, SessionInfo } from "../types/message";
import type { FavoriteEntry } from "../hooks/useFavorites";
import SessionItem from "./SessionItem";

interface TreeNode {
  segment: string;
  fullPath: string;
  project?: Project;
  children: TreeNode[];
}

function buildTree(projects: Project[]): TreeNode[] {
  const root: TreeNode[] = [];

  for (const project of projects) {
    const segments = project.name.split("/");
    let current = root;

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const partialPath = segments.slice(0, i + 1).join("/");
      let node = current.find((n) => n.fullPath === partialPath);

      if (!node) {
        node = { segment, fullPath: partialPath, children: [] };
        current.push(node);
      }

      if (i === segments.length - 1) {
        node.project = project;
      }

      current = node.children;
    }
  }

  return collapseTree(root);
}

function collapseTree(nodes: TreeNode[]): TreeNode[] {
  return nodes.map((node) => {
    node.children = collapseTree(node.children);
    if (!node.project && node.children.length === 1) {
      const child = node.children[0];
      return {
        segment: node.segment + "/" + child.segment,
        fullPath: child.fullPath,
        project: child.project,
        children: child.children,
      };
    }
    return node;
  });
}

// Whether a node's subtree contains a project whose name is in `matched`.
function subtreeHasMatch(node: TreeNode, matched: Set<string>): boolean {
  if (node.project && matched.has(node.project.name)) return true;
  return node.children.some((c) => subtreeHasMatch(c, matched));
}

const PAGE = 5;
const RECENT_INITIAL = 5;

interface Props {
  cli: CliId;
  onSelectCli: (cli: CliId) => void;
  onSelectSession: (project: string, session: SessionInfo) => void;
  activeSessionId: string | null;
  openSessionIds: Set<string>;
  collapsed: boolean;
  onToggleCollapse: () => void;
  favorites: FavoriteEntry[];
  isFavorite: (id: string, project?: string) => boolean;
  onToggleFavorite: (project: string, session: SessionInfo) => void;
  onDeleteSession: (project: string, session: SessionInfo) => void;
}

const CLI_LABELS: Record<CliId, string> = {
  claude: "Claude Code",
  trae: "TRAE CLI",
  codex: "Codex CLI",
};

export default function Sidebar({
  cli,
  onSelectCli,
  onSelectSession,
  activeSessionId,
  openSessionIds,
  collapsed,
  onToggleCollapse,
  favorites,
  isFavorite,
  onToggleFavorite,
  onDeleteSession,
}: Props) {
  const [availableClis, setAvailableClis] = useState<CliOption[]>([]);
  const [cliMenuOpen, setCliMenuOpen] = useState(false);
  const cliMenuRef = useRef<HTMLDivElement>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [sessions, setSessions] = useState<Record<string, SessionInfo[]>>({});
  const [recentSessions, setRecentSessions] = useState<SessionInfo[]>([]);
  const [recentLimit, setRecentLimit] = useState(RECENT_INITIAL);
  const [recentHasMore, setRecentHasMore] = useState(false);
  const [recentLoadingMore, setRecentLoadingMore] = useState(false);
  const [recentExpanded, setRecentExpanded] = useState(true);
  const [favoritesExpanded, setFavoritesExpanded] = useState(false);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [visibleCounts, setVisibleCounts] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const isSearching = search.trim().length > 0;
  const favoriteProjects = useMemo(
    () => Array.from(new Set(favorites.map((f) => f.project))),
    [favorites]
  );
  const favoriteProjectsKey = favoriteProjects.join("\n");

  useEffect(() => {
    fetch("/api/clis")
      .then((r) => r.json())
      .then((data: CliOption[]) => setAvailableClis(data))
      .catch(() => setAvailableClis([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    setProjects([]);
    setSessions({});
    setRecentSessions([]);
    setRecentLimit(RECENT_INITIAL);
    setRecentHasMore(false);
    setExpandedDirs(new Set());
    setExpandedProject(null);
    setVisibleCounts({});
    setSearchResults([]);
    Promise.all([
      fetch(`/api/projects?cli=${cli}`).then((r) => r.json()),
      fetch(`/api/sessions/recent?cli=${cli}&limit=${RECENT_INITIAL + 1}`).then((r) =>
        r.json()
      ),
    ])
      .then(([projectsData, recentData]: [Project[], SessionInfo[]]) => {
        setProjects(projectsData);
        setRecentHasMore(recentData.length > RECENT_INITIAL);
        setRecentSessions(recentData.slice(0, RECENT_INITIAL));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [cli]);

  const loadMoreRecent = async () => {
    if (recentLoadingMore || !recentHasMore) return;
    const next = recentLimit + PAGE;
    setRecentLoadingMore(true);
    try {
      const res = await fetch(`/api/sessions/recent?cli=${cli}&limit=${next + 1}`);
      const data: SessionInfo[] = await res.json();
      setRecentHasMore(data.length > next);
      setRecentSessions(data.slice(0, next));
      setRecentLimit(next);
    } catch {
      // leave previous list intact
    } finally {
      setRecentLoadingMore(false);
    }
  };

  // Drop a deleted session from local lists / per-project caches so it disappears
  // immediately without a refetch.
  const removeSessionLocally = (project: string, sessionId: string) => {
    setRecentSessions((prev) => prev.filter((s) => s.id !== sessionId));
    setSessions((prev) => {
      const list = prev[project];
      if (!list) return prev;
      return { ...prev, [project]: list.filter((s) => s.id !== sessionId) };
    });
    setSearchResults((prev) => prev.filter((s) => s.id !== sessionId));
  };

  useEffect(() => {
    if (!cliMenuOpen) return;
    const onPointer = (e: MouseEvent) => {
      if (cliMenuRef.current && !cliMenuRef.current.contains(e.target as Node)) {
        setCliMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCliMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [cliMenuOpen]);

  const tree = useMemo(() => buildTree(projects), [projects]);

  // Debounced search request. Hits the backend which scans all projects'
  // session titles and paths.
  useEffect(() => {
    const q = search.trim();
    if (!q) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(() => {
      fetch(`/api/sessions/search?cli=${cli}&q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((data: SessionInfo[]) => setSearchResults(data))
        .catch(() => setSearchResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [search, cli]);

  useEffect(() => {
    if (favoriteProjects.length === 0) return;
    const missing = favoriteProjects.filter((project) => !sessions[project]);
    if (missing.length === 0) return;

    let cancelled = false;
    Promise.all(
      missing.map((project) =>
        fetch(`/api/sessions/${project}?cli=${cli}`)
          .then((r) => r.json())
          .then((data: SessionInfo[]) => [project, data] as const)
          .catch(() => [project, [] as SessionInfo[]] as const)
      )
    ).then((entries) => {
      if (cancelled) return;
      setSessions((prev) => {
        const next = { ...prev };
        for (const [project, data] of entries) {
          next[project] = data;
        }
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [cli, favoriteProjectsKey, sessions]);

  // Matched sessions grouped by project dirName (separate from the `sessions`
  // cache so search results never clobber the full per-project lists).
  const searchSessions = useMemo(() => {
    const byProject: Record<string, SessionInfo[]> = {};
    for (const s of searchResults) {
      (byProject[s.project!] ||= []).push(s);
    }
    return byProject;
  }, [searchResults]);

  // Project names (the slash path the tree is built from) that have a match.
  const matchedProjectNames = useMemo(() => {
    const matchedDirs = new Set(searchResults.map((s) => s.project!));
    const names = new Set<string>();
    for (const p of projects) {
      if (matchedDirs.has(p.dirName)) names.add(p.name);
    }
    return names;
  }, [projects, searchResults]);

  const favoriteSessions = useMemo(
    () =>
      favorites.map((fav) => {
        const fresh = sessions[fav.project]?.find((s) => s.id === fav.id);
        return {
          id: fav.id,
          firstMessage: fresh?.firstMessage ?? fav.firstMessage,
          timestamp: fresh?.timestamp ?? fav.timestamp,
          messageCount: fresh?.messageCount ?? fav.messageCount,
          project: fav.project,
        };
      }),
    [favorites, sessions]
  );

  const showMore = (dirName: string) => {
    setVisibleCounts((prev) => ({
      ...prev,
      [dirName]: (prev[dirName] ?? PAGE) + PAGE,
    }));
  };

  const toggleDir = (path: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const toggleProject = async (dirName: string) => {
    if (expandedProject === dirName) {
      setExpandedProject(null);
      setVisibleCounts((prev) => ({ ...prev, [dirName]: PAGE }));
      return;
    }
    setExpandedProject(dirName);

    if (!sessions[dirName]) {
      const res = await fetch(`/api/sessions/${dirName}?cli=${cli}`);
      const data = await res.json();
      setSessions((prev) => ({ ...prev, [dirName]: data }));
    }
  };

  const handleDelete = (project: string, session: SessionInfo) => {
    removeSessionLocally(project, session.id);
    onDeleteSession(project, session);
  };

  if (collapsed) {
    return (
      <div className="cc-sidebar w-10 bg-side border-r border-edge flex flex-col items-center pt-3 shrink-0 transition-colors">
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded hover:bg-accent-soft text-dim transition-colors"
          title="Expand sidebar"
        >
          »
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="cc-sidebar w-72 bg-side border-r border-edge p-4 text-dim text-sm shrink-0">
        Loading projects...
      </div>
    );
  }

  return (
    <div className="cc-sidebar w-72 bg-side border-r border-edge flex flex-col shrink-0 transition-colors">
      <div className="cc-sidebar-header p-3 border-b border-edge flex items-center justify-between gap-2">
        <div ref={cliMenuRef} className="relative min-w-0 flex-1">
          <button
            onClick={() => setCliMenuOpen((v) => !v)}
            className="w-full flex items-center gap-1.5 text-left group"
            title="切换 CLI"
            aria-haspopup="menu"
            aria-expanded={cliMenuOpen}
          >
            <h1 className="text-sm font-bold text-ink truncate">
              {CLI_LABELS[cli]}
            </h1>
            <span
              className={`text-[10px] text-dim transition-transform duration-200 ${cliMenuOpen ? "rotate-180" : ""}`}
            >
              ▾
            </span>
          </button>
          <p className="text-xs text-dim mt-0.5">{projects.length} projects</p>

          {cliMenuOpen && (
            <div
              role="menu"
              className="cc-pop-in absolute left-0 top-full mt-1.5 w-44 p-1 rounded-lg bg-surface border border-edge shadow-lg shadow-black/10 z-30"
            >
              {(availableClis.length > 0
                ? availableClis
                : (Object.keys(CLI_LABELS) as CliId[]).map((id) => ({
                    id,
                    label: CLI_LABELS[id],
                  }))
              ).map((opt) => {
                const active = opt.id === cli;
                return (
                  <button
                    key={opt.id}
                    role="menuitemradio"
                    aria-checked={active}
                    onClick={() => {
                      setCliMenuOpen(false);
                      if (!active) onSelectCli(opt.id);
                    }}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors ${
                      active
                        ? "bg-sel-bg text-sel-ink font-medium"
                        : "text-ink hover:bg-accent-soft"
                    }`}
                  >
                    <span className="flex-1 text-left">{opt.label}</span>
                    {active && <span className="text-sel-ink">✓</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded hover:bg-accent-soft text-dim transition-colors text-sm shrink-0"
          title="Collapse sidebar"
        >
          «
        </button>
      </div>

      <div className="px-2 pt-2">
        <input
          type="text"
          placeholder="搜索路径或对话标题..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="cc-search w-full px-2 py-1.5 text-xs bg-base border border-edge rounded-lg text-ink placeholder-dim focus:outline-none focus:ring-1 focus:ring-accent transition-colors"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {!isSearching && favoriteSessions.length > 0 && (
          <div className="mb-2">
            <button
              onClick={() => setFavoritesExpanded((v) => !v)}
              className="cc-nav-section w-full text-left px-2 py-1.5 rounded-md text-sm text-ink hover:bg-accent-soft flex items-center gap-1.5 transition-colors"
            >
              <span className="text-[10px] text-dim w-3 shrink-0">
                {favoritesExpanded ? "▼" : "▶"}
              </span>
              <span className="text-xs text-yellow-500 shrink-0">★</span>
              <span className="truncate flex-1 font-medium text-xs">Favorites</span>
              <span className="text-[10px] text-dim shrink-0">
                {favoriteSessions.length}
              </span>
            </button>
            {favoritesExpanded && (
              <div className="space-y-0.5 pl-5">
                {favoriteSessions.map((session) => (
                  <SessionItem
                    key={`fav-${session.project}-${session.id}`}
                    session={session}
                    isActive={activeSessionId === session.id}
                    isOpen={openSessionIds.has(session.id)}
                    isFavorite={true}
                    onClick={() => onSelectSession(session.project!, session)}
                    onToggleFavorite={() =>
                      onToggleFavorite(session.project!, session)
                    }
                    onDelete={() => handleDelete(session.project!, session)}
                  />
                ))}
              </div>
            )}
            <div className="border-b border-edge mt-2" />
          </div>
        )}

        {!isSearching && recentSessions.length > 0 && (
          <div className="mb-2">
            <button
              onClick={() => setRecentExpanded((v) => !v)}
              className="cc-nav-section w-full text-left px-2 py-1.5 rounded-md text-sm text-ink hover:bg-accent-soft flex items-center gap-1.5 transition-colors"
            >
              <span className="text-[10px] text-dim w-3 shrink-0">
                {recentExpanded ? "▼" : "▶"}
              </span>
              <span className="text-xs text-dim shrink-0">🕐</span>
              <span className="truncate flex-1 font-medium text-xs">Recent</span>
              <span className="text-[10px] text-dim shrink-0">
                {recentSessions.length}
              </span>
            </button>
            {recentExpanded && (
              <div className="space-y-0.5 pl-5">
                {recentSessions.map((session) => (
                  <SessionItem
                    key={`recent-${session.id}`}
                    session={session}
                    isActive={activeSessionId === session.id}
                    isOpen={openSessionIds.has(session.id)}
                    isFavorite={isFavorite(session.id, session.project)}
                    onClick={() => onSelectSession(session.project!, session)}
                    onToggleFavorite={() => onToggleFavorite(session.project!, session)}
                    onDelete={() => handleDelete(session.project!, session)}
                  />
                ))}
                {recentHasMore && (
                  <button
                    onClick={loadMoreRecent}
                    disabled={recentLoadingMore}
                    className="w-full text-left px-3 py-1.5 rounded-md text-xs text-dim hover:bg-accent-soft hover:text-accent transition-colors disabled:opacity-50"
                  >
                    {recentLoadingMore
                      ? "加载中…"
                      : `⋯ 显示更多（再加载 ${PAGE} 条）`}
                  </button>
                )}
              </div>
            )}
            <div className="border-b border-edge mt-2" />
          </div>
        )}

        {tree.map((node) => (
          <TreeNodeItem
            key={node.fullPath}
            node={node}
            depth={0}
            expandedDirs={expandedDirs}
            expandedProject={expandedProject}
            sessions={sessions}
            searchSessions={searchSessions}
            visibleCounts={visibleCounts}
            isSearching={isSearching}
            matchedProjectNames={matchedProjectNames}
            activeSessionId={activeSessionId}
            openSessionIds={openSessionIds}
            isFavorite={isFavorite}
            onToggleFavorite={onToggleFavorite}
            onDelete={handleDelete}
            onToggleDir={toggleDir}
            onToggleProject={toggleProject}
            onSelectSession={onSelectSession}
            onShowMore={showMore}
          />
        ))}

        {isSearching && matchedProjectNames.size === 0 && (
          <p className="px-3 py-4 text-xs text-dim text-center">
            未找到匹配的路径或对话
          </p>
        )}
      </div>
    </div>
  );
}

interface TreeNodeItemProps {
  node: TreeNode;
  depth: number;
  expandedDirs: Set<string>;
  expandedProject: string | null;
  sessions: Record<string, SessionInfo[]>;
  searchSessions: Record<string, SessionInfo[]>;
  visibleCounts: Record<string, number>;
  isSearching: boolean;
  matchedProjectNames: Set<string>;
  activeSessionId: string | null;
  openSessionIds: Set<string>;
  isFavorite: (id: string, project?: string) => boolean;
  onToggleFavorite: (project: string, session: SessionInfo) => void;
  onDelete: (project: string, session: SessionInfo) => void;
  onToggleDir: (path: string) => void;
  onToggleProject: (dirName: string) => void;
  onSelectSession: (project: string, session: SessionInfo) => void;
  onShowMore: (dirName: string) => void;
}

function TreeNodeItem({
  node,
  depth,
  expandedDirs,
  expandedProject,
  sessions,
  searchSessions,
  visibleCounts,
  isSearching,
  matchedProjectNames,
  activeSessionId,
  openSessionIds,
  isFavorite,
  onToggleFavorite,
  onDelete,
  onToggleDir,
  onToggleProject,
  onSelectSession,
  onShowMore,
}: TreeNodeItemProps) {
  // In search mode, hide any branch that contains no matches.
  if (isSearching && !subtreeHasMatch(node, matchedProjectNames)) {
    return null;
  }

  const hasChildren = node.children.length > 0;
  const hasProject = !!node.project;
  const isDir = hasChildren && !hasProject;
  const isDirExpanded = expandedDirs.has(node.fullPath);
  const isProjectExpanded = hasProject && expandedProject === node.project!.dirName;

  const handleClick = () => {
    if (hasProject) {
      if (hasChildren) {
        onToggleDir(node.fullPath);
      }
      onToggleProject(node.project!.dirName);
    } else {
      onToggleDir(node.fullPath);
    }
  };

  // Matched branches are force-expanded while searching.
  const isExpanded = isSearching
    ? true
    : hasProject
      ? isProjectExpanded || isDirExpanded
      : isDirExpanded;

  return (
    <div>
      <button
        onClick={handleClick}
        className="cc-nav-section w-full text-left px-2 py-1.5 rounded-md text-sm text-ink hover:bg-accent-soft flex items-center gap-1.5 transition-colors"
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        <span className="text-[10px] text-dim w-3 shrink-0">
          {hasChildren || hasProject ? (isExpanded ? "▼" : "▶") : ""}
        </span>
        {isDir ? (
          <span className="text-xs text-dim shrink-0">📁</span>
        ) : (
          <span className="text-xs text-dim shrink-0">📂</span>
        )}
        <span className="truncate flex-1 font-medium text-xs">{node.segment}</span>
        {hasProject && (
          <span className="text-[10px] text-dim shrink-0">
            {node.project!.sessionCount}
          </span>
        )}
      </button>

      {isExpanded && (
        <div>
          {hasProject && (() => {
            const dir = node.project!.dirName;
            const list = isSearching ? searchSessions[dir] ?? [] : sessions[dir] ?? [];
            if (list.length === 0) return null;
            const limit = isSearching ? list.length : visibleCounts[dir] ?? PAGE;
            const hasMore = !isSearching && list.length > limit;
            return (
              <div
                className="space-y-0.5"
                style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}
              >
                {list.slice(0, limit).map((session) => (
                  <SessionItem
                    key={session.id}
                    session={session}
                    isActive={activeSessionId === session.id}
                    isOpen={openSessionIds.has(session.id)}
                    isFavorite={isFavorite(session.id, dir)}
                    onClick={() => onSelectSession(dir, session)}
                    onToggleFavorite={() => onToggleFavorite(dir, session)}
                    onDelete={() => onDelete(dir, session)}
                  />
                ))}
                {hasMore && (
                  <button
                    onClick={() => onShowMore(dir)}
                    className="w-full text-left px-3 py-1.5 rounded-md text-xs text-dim hover:bg-accent-soft hover:text-accent transition-colors"
                  >
                    ⋯ 显示更多（还有 {list.length - limit} 个）
                  </button>
                )}
              </div>
            );
          })()}

          {hasChildren &&
            node.children.map((child) => (
              <TreeNodeItem
                key={child.fullPath}
                node={child}
                depth={depth + 1}
                expandedDirs={expandedDirs}
                expandedProject={expandedProject}
                sessions={sessions}
                searchSessions={searchSessions}
                visibleCounts={visibleCounts}
                isSearching={isSearching}
                matchedProjectNames={matchedProjectNames}
                activeSessionId={activeSessionId}
                openSessionIds={openSessionIds}
                isFavorite={isFavorite}
                onToggleFavorite={onToggleFavorite}
                onDelete={onDelete}
                onToggleDir={onToggleDir}
                onToggleProject={onToggleProject}
                onSelectSession={onSelectSession}
                onShowMore={onShowMore}
              />
            ))}
        </div>
      )}
    </div>
  );
}
