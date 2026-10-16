import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Agent, Run, RunEvent } from "@bankai/contracts";
import { api, streamRun } from "../api.js";
import { relTime, absTime, fmtDuration } from "../lib/format.js";
import { RUN_STATUSES, RUN_STATUS_META } from "../lib/domain.js";
import { Badge, Chip } from "../components/ui/Badge.js";
import { Button, IconButton } from "../components/ui/Button.js";
import { Select } from "../components/ui/Field.js";
import { Dialog } from "../components/ui/Dialog.js";
import { EmptyState, Skeleton } from "../components/ui/Loading.js";
import { Alert } from "../components/ui/Alert.js";
import { Icon } from "../components/ui/Icon.js";
import { useToast } from "../components/ui/Toasts.js";

function runTitle(run: Run): string {
  const prompt = run.prompt.trim();
  return prompt.length > 90 ? `${prompt.slice(0, 89)}…` : prompt || run.id;
}

/* ---------- event timeline ---------- */

const EVENT_ICON: Record<string, Parameters<typeof Icon>[0]["name"]> = {
  queued: "clock",
  started: "zap",
  finished: "check",
  failed: "alert",
  cancelled: "stop",
  interrupted: "alert",
  tool_call: "terminal",
  tool_result: "terminal",
  delta: "chat",
};

function EventItem({ event }: { event: RunEvent }) {
  let tone = "neutral";
  let title: React.ReactNode = "";
  let body: React.ReactNode = null;

  switch (event.type) {
    case "queued":
      tone = "warn";
      title = "Queued";
      break;
    case "started":
      tone = "accent";
      title = "Started";
      break;
    case "finished":
      tone = "ok";
      title = "Finished";
      break;
    case "failed":
      tone = "danger";
      title = "Failed";
      body = <pre className="tl-text">{event.error}</pre>;
      break;
    case "cancelled":
      title = "Cancelled";
      break;
    case "interrupted":
      tone = "danger";
      title = "Interrupted (server restart)";
      break;
    case "tool_call": {
      tone = "accent";
      title = (
        <>
          Tool <span className="mono">{event.name}</span>
        </>
      );
      body = <pre className="tl-text">{event.args}</pre>;
      break;
    }
    case "tool_result": {
      title = (
        <>
          Result <span className="mono">{event.name}</span>
        </>
      );
      body = <pre className="tl-text">{event.output}</pre>;
      break;
    }
    case "delta": {
      title = "Response";
      body = <pre className="tl-text">{event.text}</pre>;
      break;
    }
  }

  return (
    <div className="tl-item">
      <span className={`tl-dot ${tone}`}>
        <Icon name={EVENT_ICON[event.type] ?? "clock"} />
      </span>
      <div className="tl-body">
        <div className="tl-head">
          <span className="tl-title">{title}</span>
          <span className="tl-time num" title={absTime(event.at)}>
            {relTime(event.at)}
          </span>
        </div>
        {body}
      </div>
    </div>
  );
}

function EventTimeline({ events }: { events: RunEvent[] }) {
  if (events.length === 0) {
    return <p className="meta">No events recorded yet.</p>;
  }
  return (
    <div className="timeline">
      {events.map((e, i) => (
        <EventItem key={i} event={e} />
      ))}
    </div>
  );
}

/* ---------- run row ---------- */

function RunRow({
  run,
  agentName,
  onWatch,
  onCancel,
  cancelling,
}: {
  run: Run;
  agentName: string;
  onWatch: () => void;
  onCancel: () => void;
  cancelling: boolean;
}) {
  const [open, setOpen] = useState(false);
  const meta = RUN_STATUS_META[run.status];
  const active = run.status === "queued" || run.status === "running";
  const toolCalls = run.events.filter((e) => e.type === "tool_call");
  const failedText = run.error ?? run.events.find((e) => e.type === "failed")?.error ?? null;

  return (
    <li className={`card run-row${open ? " open" : ""}`}>
      <button type="button" className="run-head" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="chev">
          <Icon name="chevron-right" />
        </span>
        <div className="run-head-main">
          <span className="run-prompt-line">{runTitle(run)}</span>
          <span className="meta">
            {agentName} · {relTime(run.startedAt)} · <span className="num">{fmtDuration(run.startedAt, run.finishedAt)}</span>
            {toolCalls.length > 0 && <> · {toolCalls.length} tool call{toolCalls.length === 1 ? "" : "s"}</>}
          </span>
        </div>
        <Badge tone={meta.tone} icon={run.status === "running" || run.status === "queued" ? "spinner" : undefined}>
          {meta.label}
        </Badge>
      </button>

      {open && (
        <div className="run-detail">
          <div className="stack-row" style={{ border: "none", padding: "2px 0" }}>
            <span className="meta num">{absTime(run.startedAt)}</span>
            {active && (
              <>
                <span className="spacer" style={{ flex: 1 }} />
                <Button size="sm" variant="tonal" icon="zap" onClick={onWatch} title="Connect to this run's live stream">
                  {run.status === "queued" ? "Start & watch" : "Watch live"}
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  icon="stop"
                  onClick={onCancel}
                  loading={cancelling}
                >
                  Cancel
                </Button>
              </>
            )}
          </div>

          {failedText && (
            <Alert kind="error">
              <span className="clamp-3">{failedText}</span>
            </Alert>
          )}

          <EventTimeline events={run.events} />

          <details>
            <summary className="meta" style={{ cursor: "pointer" }}>
              Raw JSON ({run.events.length} events)
            </summary>
            <pre className="raw">{JSON.stringify(run, null, 2)}</pre>
          </details>
        </div>
      )}
    </li>
  );
}

/* ---------- live watch dialog ---------- */

function WatchDialog({
  run,
  agentName,
  onClose,
  onCancelRun,
}: {
  run: Run | null;
  agentName: string;
  onClose: () => void;
  onCancelRun: () => void;
}) {
  const [text, setText] = useState("");
  const [tools, setTools] = useState<Array<{ callId: string; name: string; args?: string; output?: string | null }>>([]);
  const [ended, setEnded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detachPrompt, setDetachPrompt] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const status = run?.status ?? null;
  const active = status === "queued" || status === "running";

  useEffect(() => {
    if (!run || !active) return;
    const abort = new AbortController();
    abortRef.current = abort;
    void (async () => {
      try {
        await streamRun(run.id, (event: RunEvent) => {
          switch (event.type) {
            case "delta":
              setText((t) => t + event.text);
              break;
            case "tool_call":
              setTools((ts) => [...ts, { callId: event.id, name: event.name, args: event.args, output: null }]);
              break;
            case "tool_result":
              setTools((ts) => ts.map((t) => (t.callId === event.id ? { ...t, output: event.output } : t)));
              break;
            case "failed":
              setEnded("failed");
              setError(event.error);
              break;
            case "cancelled":
              setEnded("cancelled");
              break;
            case "finished":
              setEnded("completed");
              break;
            default:
              break;
          }
        }, abort.signal);
      } catch (e) {
        if (abort.signal.aborted) return;
        setError((e as Error).message);
      }
    })();

    return () => {
      abort.abort(); // detaches the stream; the run itself is only stopped via Cancel
    };
  }, [run?.id, active]);

  if (!run) return null;

  const requestClose = () => {
    // Per the stream contract, closing the connection while the run is live
    // aborts it — make that explicit instead of a silent surprise.
    if (active && !ended) {
      setDetachPrompt(true);
      return;
    }
    onClose();
  };

  if (detachPrompt) {
    return (
      <Dialog
        open
        onClose={() => setDetachPrompt(false)}
        title="Detach from this run?"
        footer={
          <>
            <span className="spacer" />
            <Button variant="ghost" onClick={() => setDetachPrompt(false)}>
              Keep watching
            </Button>
            <Button variant="danger" icon="stop" onClick={onClose}>
              Detach & cancel run
            </Button>
          </>
        }
      >
        <Alert kind="warn">
          Runs execute only while a client is attached to their stream. Closing the viewer now cancels
          the rest of this run. Use “Cancel run” instead if you want that explicitly.
        </Alert>
      </Dialog>
    );
  }

  return (
    <Dialog
      open
      onClose={requestClose}
      wide
      title={runTitle(run)}
      subtitle={`${agentName} · ${run.id} · ${RUN_STATUS_META[run.status].label}`}
      footer={
        <>
          <Button variant="ghost" onClick={requestClose}>
            Close
          </Button>
          {active && (
            <Button variant="danger" icon="stop" onClick={onCancelRun}>
              Cancel run
            </Button>
          )}
        </>
      }
    >
      {status === "queued" && !ended && (
        <Alert kind="info">
          Attaching to a queued run starts it — queued runs only execute while a client is connected.
        </Alert>
      )}
      {error && (
        <Alert kind="error">{error}</Alert>
      )}
      {tools.map((t) => (
        <div className="tool-card open" key={t.callId}>
          <div className="tool-card-head" style={{ cursor: "default" }}>
            <Icon name="terminal" />
            <span>{t.name}</span>
            {t.output == null && <span className="faint">running…</span>}
          </div>
          {t.output != null && (
            <div className="tool-card-body">
              <span className="tool-card-label">Result</span>
              <pre>{t.output || "(empty result)"}</pre>
            </div>
          )}
        </div>
      ))}
      {text && (
        <div className="bubble" style={{ maxWidth: "none" }}>
          {text}
        </div>
      )}
      {!text && tools.length === 0 && !ended && (
        <span className="spinner centered-spin" aria-label="Connecting to stream" />
      )}
      {ended && !error && (
        <Alert kind={ended === "completed" ? "ok" : "warn"}>
          {ended === "completed" ? "Run completed." : ended === "cancelled" ? "Run was cancelled." : "Run ended."}
        </Alert>
      )}
    </Dialog>
  );
}

/* ---------- page ---------- */

export function Runs() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [agentFilter, setAgentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<string | null>(null);
  const [watching, setWatching] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const toast = useToast();

  const load = useCallback(async () => {
    try {
      const [agentList, runList] = await Promise.all([
        api.get<Agent[]>("/agents"),
        api.get<Run[]>(agentFilter ? `/runs?agentId=${encodeURIComponent(agentFilter)}&limit=100` : "/runs?limit=100"),
      ]);
      setAgents(agentList);
      setRuns(runList);
      setBanner(null);
    } catch (e) {
      setBanner((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [agentFilter]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const agentName = useCallback(
    (id: string) => agents.find((a) => a.id === id)?.name ?? "deleted agent",
    [agents]
  );

  const counts = useMemo(() => {
    const base = {
      total: runs.length,
      active: 0,
      failed: 0,
      queued: 0,
      running: 0,
      completed: 0,
      cancelled: 0,
      interrupted: 0,
    };
    for (const r of runs) {
      if (r.status === "running" || r.status === "queued") base.active++;
      if (r.status === "failed") base.failed++;
      base[r.status] = (base[r.status] ?? 0) + 1;
    }
    return base;
  }, [runs]);

  const filtered = useMemo(
    () => (statusFilter === "all" ? runs : runs.filter((r) => r.status === statusFilter)),
    [runs, statusFilter]
  );

  const watchedRun = useMemo(() => runs.find((r) => r.id === watching) ?? null, [runs, watching]);

  async function cancelRun(runId: string) {
    setCancelling(runId);
    try {
      await api.post(`/runs/${runId}/cancel`);
      toast.info("Cancellation requested");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCancelling(null);
    }
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>
            <Icon name="runs" /> Runs
          </h1>
          <p className="page-sub">
            Every execution is recorded — status, tool activity and errors included.
          </p>
        </div>
        <div className="page-actions">
          <IconButton icon="refresh" label="Refresh runs" onClick={() => void load()} />
        </div>
      </header>

      <div className="filter-bar">
        <Select
          className="compact"
          value={agentFilter}
          onChange={(e) => setAgentFilter(e.target.value)}
          aria-label="Filter by agent"
        >
          <option value="">All agents</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
        <div className="chip-row" role="group" aria-label="Filter by status">
          <Chip className={statusFilter === "all" ? "active" : ""} onClick={() => setStatusFilter("all")}>
            All ({counts.total})
          </Chip>
          {RUN_STATUSES.filter((s) => (counts[s] ?? 0) > 0 || s === "failed").map((s) => (
            <Chip
              key={s}
              className={statusFilter === s ? "active" : ""}
              onClick={() => setStatusFilter(s)}
            >
              {RUN_STATUS_META[s].label} ({counts[s] ?? 0})
            </Chip>
          ))}
        </div>
      </div>

      {banner && (
        <Alert kind="error" onClose={() => setBanner(null)}>
          {banner}
        </Alert>
      )}

      {loading ? (
        <Skeleton />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="runs"
          title="No runs match"
          description={
            runs.length === 0
              ? "Runs appear here once you chat with an agent or a scheduled task fires."
              : "No runs with this status. Clear the filter to see everything."
          }
        />
      ) : (
        <ul className="stack-list" style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map((run) => (
            <RunRow
              key={run.id}
              run={run}
              agentName={agentName(run.agentId)}
              cancelling={cancelling === run.id}
              onCancel={() => void cancelRun(run.id)}
              onWatch={() => setWatching(run.id)}
            />
          ))}
        </ul>
      )}

      {watchedRun && (
        <WatchDialog
          run={watchedRun}
          agentName={agentName(watchedRun.agentId)}
          onClose={() => setWatching(null)}
          onCancelRun={() => void cancelRun(watchedRun.id)}
        />
      )}
    </div>
  );
}
