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
  const [loading, setLoading] = useState(true);

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
      <div className="w-10 bg-gray-50 border-r border-gray-200 flex flex-col items-center pt-3 shrink-0">
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded hover:bg-gray-200 text-gray-500 transition-colors"
          title="Expand sidebar"
        >
          »
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="w-72 bg-gray-50 border-r border-gray-200 p-4 text-gray-500 text-sm shrink-0">
        Loading projects...
      </div>
    );
  }

  return (
    <div className="w-72 bg-gray-50 border-r border-gray-200 flex flex-col shrink-0">
      <div className="p-3 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h1 className="text-sm font-bold text-gray-800">CC Reader</h1>
          <p className="text-xs text-gray-500 mt-0.5">{projects.length} projects</p>
        </div>
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded hover:bg-gray-200 text-gray-500 transition-colors text-sm"
          title="Collapse sidebar"
        >
          «
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {recentSessions.length > 0 && (
          <div className="mb-2">
            <button
              onClick={() => setRecentExpanded((v) => !v)}
              className="w-full text-left px-2 py-1.5 rounded-md text-sm text-gray-600 hover:bg-gray-200/60 flex items-center gap-1.5 transition-colors"
            >
              <span className="text-[10px] text-gray-400 w-3 shrink-0">
                {recentExpanded ? "▼" : "▶"}
              </span>
              <span className="text-xs text-gray-400 shrink-0">🕐</span>
              <span className="truncate flex-1 font-medium text-xs">Recent</span>
              <span className="text-[10px] text-gray-400 shrink-0">
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
            <div className="border-b border-gray-200 mt-2" />
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
            activeSessionId={activeSessionId}
            openSessionIds={openSessionIds}
            onToggleDir={toggleDir}
            onToggleProject={toggleProject}
            onSelectSession={onSelectSession}
          />
        ))}
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
  activeSessionId: string | null;
  openSessionIds: Set<string>;
  onToggleDir: (path: string) => void;
  onToggleProject: (dirName: string) => void;
  onSelectSession: (project: string, session: SessionInfo) => void;
}

function TreeNodeItem({
  node,
  depth,
  expandedDirs,
  expandedProject,
  sessions,
  activeSessionId,
  openSessionIds,
  onToggleDir,
  onToggleProject,
  onSelectSession,
}: TreeNodeItemProps) {
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

  const isExpanded = hasProject ? isProjectExpanded || isDirExpanded : isDirExpanded;

  return (
    <div>
      <button
        onClick={handleClick}
        className="w-full text-left px-2 py-1.5 rounded-md text-sm text-gray-600 hover:bg-gray-200/60 flex items-center gap-1.5 transition-colors"
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        <span className="text-[10px] text-gray-400 w-3 shrink-0">
          {hasChildren || hasProject ? (isExpanded ? "▼" : "▶") : ""}
        </span>
        {isDir ? (
          <span className="text-xs text-gray-400 shrink-0">📁</span>
        ) : (
          <span className="text-xs text-gray-400 shrink-0">📂</span>
        )}
        <span className="truncate flex-1 font-medium text-xs">{node.segment}</span>
        {hasProject && (
          <span className="text-[10px] text-gray-400 shrink-0">
            {node.project!.sessionCount}
          </span>
        )}
      </button>

      {isExpanded && (
        <div>
          {hasProject && sessions[node.project!.dirName] && (
            <div className="space-y-0.5" style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}>
              {sessions[node.project!.dirName].map((session) => (
                <SessionItem
                  key={session.id}
                  session={session}
                  isActive={activeSessionId === session.id}
                  isOpen={openSessionIds.has(session.id)}
                  onClick={() => onSelectSession(node.project!.dirName, session)}
                />
              ))}
            </div>
          )}

          {hasChildren &&
            node.children.map((child) => (
              <TreeNodeItem
                key={child.fullPath}
                node={child}
                depth={depth + 1}
                expandedDirs={expandedDirs}
                expandedProject={expandedProject}
                sessions={sessions}
                activeSessionId={activeSessionId}
                openSessionIds={openSessionIds}
                onToggleDir={onToggleDir}
                onToggleProject={onToggleProject}
                onSelectSession={onSelectSession}
              />
            ))}
        </div>
      )}
    </div>
  );
}
