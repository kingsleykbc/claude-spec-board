import { useEffect, useState } from 'react';
import { api } from './api/client';
import { useProject } from './state/useProject';

/** Minimal shell for now: proves the data flow. Tasks 8-12 build the board. */
export function App() {
  const [pid, setPid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .projects()
      .then((list) => {
        const first = list[0];
        if (first) setPid(first.id);
        else setError('No projects yet. Run spec-board in a project folder.');
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--fg)', fontFamily: 'var(--sans)', padding: 24 }}>
      {pid ? <ProjectName pid={pid} /> : <span style={{ color: 'var(--fg3)' }}>{error ?? 'Loading…'}</span>}
    </div>
  );
}

function ProjectName({ pid }: { pid: string }) {
  const { data, conn, error } = useProject(pid);
  if (!data) return <span style={{ color: 'var(--fg3)' }}>{error ? error.message : 'Loading…'}</span>;
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
      <h1 style={{ margin: 0, fontSize: 34, fontWeight: 600, letterSpacing: '-0.02em' }}>{data.project.config?.name || data.entry.name}</h1>
      <span data-testid="conn" style={{ fontSize: 12, color: 'var(--fg3)' }}>
        {conn}
      </span>
    </div>
  );
}
