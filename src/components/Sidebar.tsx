import { useState, useEffect, useMemo } from "react";
import type { Project, SessionInfo } from "../types/message";
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

interface Props {
  onSelectSession: (project: string, session: SessionInfo) => void;
  activeSessionId: string | null;
  openSessionIds: Set<string>;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export default function Sidebar({
  onSelectSession,
  activeSessionId,
  openSessionIds,
  collapsed,
  onToggleCollapse,
}: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [sessions, setSessions] = useState<Record<string, SessionInfo[]>>({});
  const [recentSessions, setRecentSessions] = useState<SessionInfo[]>([]);
  const [recentExpanded, setRecentExpanded] = useState(true);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [visibleCounts, setVisibleCounts] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const isSearching = search.trim().length > 0;

  useEffect(() => {
    Promise.all([
      fetch("/api/projects").then((r) => r.json()),
      fetch("/api/sessions/recent").then((r) => r.json()),
    ])
      .then(([projectsData, recentData]) => {
        setProjects(projectsData);
        setRecentSessions(recentData);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

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
      fetch(`/api/sessions/search?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((data: SessionInfo[]) => setSearchResults(data))
        .catch(() => setSearchResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

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
      const res = await fetch(`/api/sessions/${dirName}`);
      const data = await res.json();
      setSessions((prev) => ({ ...prev, [dirName]: data }));
    }
  };

  if (collapsed) {
    return (
      <div className="w-10 bg-side border-r border-edge flex flex-col items-center pt-3 shrink-0 transition-colors">
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
      <div className="w-72 bg-side border-r border-edge p-4 text-dim text-sm shrink-0">
        Loading projects...
      </div>
    );
  }

  return (
    <div className="w-72 bg-side border-r border-edge flex flex-col shrink-0 transition-colors">
      <div className="p-3 border-b border-edge flex items-center justify-between">
        <div>
          <h1 className="text-sm font-bold text-ink">CC Reader</h1>
          <p className="text-xs text-dim mt-0.5">{projects.length} projects</p>
        </div>
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded hover:bg-accent-soft text-dim transition-colors text-sm"
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
          className="w-full px-2 py-1.5 text-xs bg-base border border-edge rounded text-ink placeholder-dim focus:outline-none focus:ring-1 focus:ring-accent transition-colors"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {!isSearching && recentSessions.length > 0 && (
          <div className="mb-2">
            <button
              onClick={() => setRecentExpanded((v) => !v)}
              className="w-full text-left px-2 py-1.5 rounded-md text-sm text-ink hover:bg-accent-soft flex items-center gap-1.5 transition-colors"
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
                    onClick={() => onSelectSession(session.project!, session)}
                  />
                ))}
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
        className="w-full text-left px-2 py-1.5 rounded-md text-sm text-ink hover:bg-accent-soft flex items-center gap-1.5 transition-colors"
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
                    onClick={() => onSelectSession(dir, session)}
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
