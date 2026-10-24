import { useCallback, useEffect, useMemo, useState } from "react";
import type { Agent, Conversation, Run, Task } from "@bankai/contracts";
import { api } from "../api.js";
import { relTime, durationMs } from "../lib/format.js";
import { RUN_STATUS_META } from "../lib/domain.js";
import { Badge } from "../components/ui/Badge.js";
import { Button } from "../components/ui/Button.js";
import { EmptyState, Skeleton } from "../components/ui/Loading.js";
import { Alert } from "../components/ui/Alert.js";
import { Icon } from "../components/ui/Icon.js";

const DOT_TONE: Record<string, string> = {
  ok: "ok",
  danger: "danger",
  warn: "warn",
  accent: "accent",
  info: "accent",
  neutral: "",
};

interface Snapshot {
  agents: Agent[];
  conversations: Conversation[];
  runs: Run[];
  tasks: Task[];
}

export function Overview({ onNavigate }: { onNavigate: (route: string) => void }) {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [agents, conversations, runs, tasks] = await Promise.all([
        api.get<Agent[]>("/agents"),
        api.get<Conversation[]>("/conversations"),
        api.get<Run[]>("/runs?limit=8"),
        api.get<Task[]>("/tasks"),
      ]);
      setSnap({ agents, conversations, runs, tasks });
      setBanner(null);
    } catch (e) {
      setBanner((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    if (!snap) return null;
    const enabledAgents = snap.agents.filter((a) => a.enabled).length;
    const activeRuns = snap.runs.filter((r) => r.status === "running" || r.status === "queued").length;
    const failedRuns = snap.runs.filter((r) => r.status === "failed").length;
    const activeTasks = snap.tasks.filter((t) => t.enabled).length;
    return { enabledAgents, agents: snap.agents.length, conversations: snap.conversations.length, activeRuns, failedRuns, activeTasks, tasks: snap.tasks.length };
  }, [snap]);

  if (loading) {
    return (
      <div className="page">
        <Skeleton />
      </div>
    );
  }

  const firstAgent = snap?.agents[0];

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>
            <Icon name="overview" /> Overview
          </h1>
          <p className="page-sub">What the system is doing right now.</p>
        </div>
        <div className="page-actions">
          <Button icon="refresh" size="sm" onClick={() => void load()}>
            Refresh
          </Button>
          <Button variant="primary" icon="chat" onClick={() => onNavigate("chat")}>
            Open chat
          </Button>
        </div>
      </header>

      {banner && (
        <Alert kind="error" onClose={() => setBanner(null)}>
          {banner}
        </Alert>
      )}

      {stats && stats.agents === 0 ? (
        <EmptyState
          icon="zap"
          title="Welcome to Bankai OS"
          description="Create an agent to get started — a fresh server normally seeds one automatically. An agent needs a model provider key before it can run."
          action={
            <div className="row" style={{ gap: 8 }}>
              <Button variant="primary" icon="agents" onClick={() => onNavigate("agents")}>
                Manage agents
              </Button>
              <Button icon="key" onClick={() => onNavigate("settings")}>
                Add provider key
              </Button>
            </div>
          }
        />
      ) : null}

      {stats && (
        <div className="tiles">
          <article className="tile">
            <div className="tile-head">
              <span className="upper-label">Agents</span>
              <Icon name="agents" />
            </div>
            <div className="tile-num num">
              {stats.enabledAgents}
              <span className="faint" style={{ fontSize: 16, fontWeight: 500 }}> / {stats.agents}</span>
            </div>
            <button type="button" className="btn ghost sm tile-link" onClick={() => onNavigate("agents")}>
              Manage agents <Icon name="arrow-right" size={12} />
            </button>
          </article>

          <article className="tile">
            <div className="tile-head">
              <span className="upper-label">Conversations</span>
              <Icon name="chat" />
            </div>
            <div className="tile-num num">{stats.conversations}</div>
            <button type="button" className="btn ghost sm tile-link" onClick={() => onNavigate("chat")}>
              Open chat <Icon name="arrow-right" size={12} />
            </button>
          </article>

          <article className="tile">
            <div className="tile-head">
              <span className="upper-label">Active runs</span>
              <Icon name="runs" />
            </div>
            <div className="tile-num num">{stats.activeRuns}</div>
            <span className="tile-sub">
              {stats.failedRuns > 0 ? (
                <>
                  <span className="dot danger" /> {stats.failedRuns} recent failure{stats.failedRuns === 1 ? "" : "s"}
                </>
              ) : (
                <>
                  <span className="dot ok" /> recent runs finished fine
                </>
              )}
            </span>
            <button type="button" className="btn ghost sm tile-link" onClick={() => onNavigate("runs")}>
              All runs <Icon name="arrow-right" size={12} />
            </button>
          </article>

          <article className="tile">
            <div className="tile-head">
              <span className="upper-label">Scheduled tasks</span>
              <Icon name="tasks" />
            </div>
            <div className="tile-num num">
              {stats.activeTasks}
              <span className="faint" style={{ fontSize: 16, fontWeight: 500 }}> / {stats.tasks}</span>
            </div>
            <button type="button" className="btn ghost sm tile-link" onClick={() => onNavigate("tasks")}>
              Manage tasks <Icon name="arrow-right" size={12} />
            </button>
          </article>
        </div>
      )}

      {snap && snap.runs.length > 0 && (
        <div className="grid-2">
          <section className="panel-section recent-runs">
            <div className="section-head">
              <h2 style={{ margin: 0, fontSize: "var(--fs-lg)" }}>Recent runs</h2>
              <button type="button" className="btn ghost sm" onClick={() => onNavigate("runs")}>
                View all <Icon name="arrow-right" size={13} />
              </button>
            </div>
            <div className="card" style={{ padding: "4px 14px" }}>
              {snap.runs.map((run) => {
                const meta = RUN_STATUS_META[run.status];
                const dur = durationMs(run.startedAt, run.finishedAt);
                return (
                  <button type="button" className="stack-row" key={run.id} onClick={() => onNavigate("runs")}>
                    <span className={`dot ${DOT_TONE[meta.tone] ?? ""}`} />
                    <span className="grow">
                      <span className="run-prompt-line" style={{ color: "var(--text)" }}>
                        {run.prompt.trim().length > 86 ? `${run.prompt.trim().slice(0, 85)}…` : run.prompt.trim() || run.id}
                      </span>
                      <span className="meta">
                        {agentLabel(snap, run.agentId)} · {relTime(run.startedAt)}
                        {dur !== null && <> · {Math.round(dur / 1000)}s</>}
                      </span>
                    </span>
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="panel-section">
            <div className="section-head">
              <h2 style={{ margin: 0, fontSize: "var(--fs-lg)" }}>Agents</h2>
              <button type="button" className="btn ghost sm" onClick={() => onNavigate("agents")}>
                Edit <Icon name="arrow-right" size={13} />
              </button>
            </div>
            <div className="card" style={{ padding: "4px 14px" }}>
              {snap.agents.map((agent) => (
                <div className="stack-row" key={agent.id}>
                  <span className={`dot ${agent.enabled ? "ok" : ""}`} />
                  <span className="grow">
                    <span className="small" style={{ color: "var(--text)" }}>{agent.name}</span>
                    <span className="meta clamp-1">{agent.model}</span>
                  </span>
                  <Badge tone={agent.enabled ? "ok" : "neutral"}>{agent.enabled ? "Enabled" : "Disabled"}</Badge>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {snap && snap.runs.length === 0 && stats && stats.agents > 0 && (
        <div className="empty">
          <Icon name="zap" />
          <h3>No runs yet</h3>
          <p>
            Open a chat with {firstAgent?.name ?? "an agent"} and send the first message — or schedule a
            recurring task.
          </p>
          <div className="row" style={{ gap: 8 }}>
            <Button variant="primary" icon="chat" onClick={() => onNavigate("chat")}>
              Start chatting
            </Button>
            <Button icon="tasks" onClick={() => onNavigate("tasks")}>
              Schedule a task
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function agentLabel(snap: Snapshot, agentId: string): string {
  return snap.agents.find((a) => a.id === agentId)?.name ?? "agent";
}
