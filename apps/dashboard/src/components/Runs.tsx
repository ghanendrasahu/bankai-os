import { useCallback, useEffect, useState } from "react";
import type { Agent, Run } from "@bankai/contracts";
import { api } from "../api.js";
import { formatRunEvents, formatTime, runTitle } from "../types.js";

export function Runs() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentFilter, setAgentFilter] = useState("");
  const [runs, setRuns] = useState<Run[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setAgents(await api.get<Agent[]>("/agents"));
      const path = agentFilter ? `/runs?agentId=${encodeURIComponent(agentFilter)}&limit=100` : "/runs?limit=100";
      setRuns(await api.get<typeof runs>(path));
    } catch (e) {
      console.error(e);
    }
  }, [agentFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function cancel(runId: string) {
    try {
      await api.post(`/runs/${runId}/cancel`);
      await load();
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div className="panel">
      <h2>Runs</h2>
      <div className="row">
        <select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)}>
          <option value="">All agents</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <button className="ghost" onClick={() => void load()}>
          Refresh
        </button>
      </div>
      <ul className="list">
        {runs.map((run) => (
          <li key={run.id} className="card">
            <div className="row space-between">
              <strong>{runTitle(run)}</strong>
              <span className={`badge ${run.status}`}>{run.status}</span>
            </div>
            <div className="muted small">
              {agents.find((a) => a.id === run.agentId)?.name ?? run.agentId} · started {formatTime(run.startedAt)}
            </div>
            {run.error && <div className="error">{(run.error as string).slice(0, 300)}</div>}
            <div className="row">
              {(run.status === "running" || run.status === "queued") && (
                <button className="ghost danger" onClick={() => cancel(run.id)}>
                  Cancel
                </button>
              )}
              <button className="ghost" onClick={() => setExpanded(expanded === run.id ? null : run.id)}>
                {expanded === run.id ? "Hide events" : "Show events"}
              </button>
            </div>
            {expanded === run.id && (
              <pre className="events">{formatRunEvents(run.events)}</pre>
            )}
          </li>
        ))}
        {runs.length === 0 && <p className="muted">No runs yet.</p>}
      </ul>
    </div>
  );
}