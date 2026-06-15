import { useState, useEffect } from "react";
import type { Project, SessionInfo } from "../types/message";
import SessionItem from "./SessionItem";

interface Props {
  onSelectSession: (project: string, session: SessionInfo) => void;
  activeSessionId: string | null;
}

export default function Sidebar({ onSelectSession, activeSessionId }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [sessions, setSessions] = useState<Record<string, SessionInfo[]>>({});
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => {
        setProjects(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

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

  if (loading) {
    return (
      <div className="w-72 bg-gray-800 border-r border-gray-700 p-4 text-gray-500 text-sm">
        Loading projects...
      </div>
    );
  }

  return (
    <div className="w-72 bg-gray-800 border-r border-gray-700 flex flex-col shrink-0">
      <div className="p-3 border-b border-gray-700">
        <h1 className="text-sm font-bold text-gray-200">CC Reader</h1>
        <p className="text-xs text-gray-500 mt-0.5">{projects.length} projects</p>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {projects.map((project) => (
          <div key={project.dirName}>
            <button
              onClick={() => toggleProject(project.dirName)}
              className="w-full text-left px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:bg-gray-700/50 flex items-center gap-2"
            >
              <span className="text-xs">
                {expandedProject === project.dirName ? "▼" : "▶"}
              </span>
              <span className="truncate flex-1">{project.name}</span>
              <span className="text-xs text-gray-500">{project.sessionCount}</span>
            </button>

            {expandedProject === project.dirName && sessions[project.dirName] && (
              <div className="ml-4 mt-1 space-y-1">
                {sessions[project.dirName].map((session) => (
                  <SessionItem
                    key={session.id}
                    session={session}
                    isActive={activeSessionId === session.id}
                    onClick={() => onSelectSession(project.dirName, session)}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
