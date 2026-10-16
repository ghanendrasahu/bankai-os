import { useCallback, useEffect, useMemo, useState } from "react";
import type { Agent, Memory } from "@bankai/contracts";
import { api } from "../api.js";
import { relTime } from "../lib/format.js";
import { Button, IconButton } from "../components/ui/Button.js";
import { Badge, Chip } from "../components/ui/Badge.js";
import { Field, Select, TextArea } from "../components/ui/Field.js";
import { EmptyState, Skeleton } from "../components/ui/Loading.js";
import { Alert } from "../components/ui/Alert.js";
import { Icon } from "../components/ui/Icon.js";
import { useToast } from "../components/ui/Toasts.js";
import { useConfirm } from "../components/ui/Dialog.js";

const KINDS = ["note", "fact", "goal", "reference"] as const;
type Kind = (typeof KINDS)[number];

const KIND_META: Record<Kind, { tone: "info" | "ok" | "warn" | "accent" }> = {
  note: { tone: "info" },
  fact: { tone: "ok" },
  goal: { tone: "warn" },
  reference: { tone: "accent" },
};

export function Memory() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentId, setAgentId] = useState("");
  const [entries, setEntries] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [memLoading, setMemLoading] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<"all" | Kind>("all");
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<Kind>("note");
  const [content, setContent] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toast = useToast();
  const confirm = useConfirm();

  const loadAgents = useCallback(async () => {
    try {
      const list = await api.get<Agent[]>("/agents");
      setAgents(list);
      setAgentId((prev) => (list.some((a) => a.id === prev) ? prev : (list[0]?.id ?? "")));
    } catch (e) {
      setBanner((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAgents();
  }, [loadAgents]);

  useEffect(() => {
    // Reset as soon as the agent changes — never show another agent's entries.
    setEntries([]);
    setBanner(null);
    setError(null);
    if (!agentId) return;
    let cancelled = false;
    setMemLoading(true);
    void (async () => {
      try {
        const list = await api.get<Memory[]>(`/agents/${encodeURIComponent(agentId)}/memory`);
        if (!cancelled) {
          setEntries(list);
          setBanner(null);
        }
      } catch (e) {
        // Failed load → empty list + banner, never stale rows from the previous agent.
        if (!cancelled) {
          setEntries([]);
          setBanner((e as Error).message);
        }
      } finally {
        if (!cancelled) setMemLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [agentId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter(
      (m) =>
        (kindFilter === "all" || m.kind === kindFilter) &&
        (!q || m.content.toLowerCase().includes(q))
    );
  }, [entries, kindFilter, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: entries.length };
    for (const m of entries) c[m.kind] = (c[m.kind] ?? 0) + 1;
    return c;
  }, [entries]);

  async function add() {
    if (!agentId || !content.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const created = await api.post<Memory>("/memory", { agentId, kind, content: content.trim() });
      setEntries((list) => [created, ...list]);
      setContent("");
      toast.success("Memory saved");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAdding(false);
    }
  }

  function remove(entry: Memory) {
    confirm.ask({
      title: "Delete memory",
      body: (
        <>
          Remove this {entry.kind} from the agent's long-term memory? The agent will no longer recall
          it in future prompts.
        </>
      ),
      confirmLabel: "Delete memory",
      danger: true,
      onConfirm: async () => {
        try {
          await api.del(`/memory/${entry.id}`);
          setEntries((list) => list.filter((m) => m.id !== entry.id));
          toast.success("Memory deleted");
        } catch (e) {
          toast.error((e as Error).message);
          throw e;
        }
      },
    });
  }

  const selectedAgent = agents.find((a) => a.id === agentId);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>
            <Icon name="memory" /> Memory
          </h1>
          <p className="page-sub">
            Long-term notes agents recall in prompts. Relevant entries are retrieved automatically by
            the runtime.
          </p>
        </div>
        <div className="page-actions">
          <Select
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            aria-label="Agent"
            className="compact"
            style={{ width: "auto" }}
          >
            {agents.length === 0 && <option value="">No agents</option>}
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </div>
      </header>

      {banner && (
        <Alert kind="error" onClose={() => setBanner(null)}>
          {banner}
        </Alert>
      )}

      {loading ? (
        <Skeleton />
      ) : !agentId ? (
        <EmptyState
          icon="agents"
          title="No agents yet"
          description="Memory is stored per agent — create one first."
        />
      ) : (
        <>
          {/* add entry */}
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: 10 }}>
              <Field label="Kind" htmlFor="mem-kind">
                <Select id="mem-kind" value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
                  {KINDS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label={`New memory for ${selectedAgent?.name ?? "agent"}`}
                htmlFor="mem-content"
                hint="Agents can also save memories themselves through the memory_store tool."
              >
                <TextArea
                  id="mem-content"
                  rows={2}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="e.g. Prefers Metric units; ships on staging first…"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      void add();
                    }
                  }}
                />
              </Field>
            </div>
            {error && <Alert kind="error">{error}</Alert>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <Button variant="primary" icon="plus" loading={adding} onClick={() => void add()} disabled={!content.trim()}>
                Save memory
              </Button>
            </div>
          </div>

          {/* filters */}
          <div className="filter-bar">
            <div className="chip-row" role="group" aria-label="Filter by kind">
              <Chip className={kindFilter === "all" ? "active" : ""} onClick={() => setKindFilter("all")}>
                All ({counts.all ?? 0})
              </Chip>
              {KINDS.filter((k) => (counts[k] ?? 0) > 0).map((k) => (
                <Chip key={k} className={kindFilter === k ? "active" : ""} onClick={() => setKindFilter(k)}>
                  {k} ({counts[k]})
                </Chip>
              ))}
            </div>
            <div className="input-wrap" style={{ width: 260, maxWidth: "100%" }}>
              <input
                className="input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search content…"
                aria-label="Search memories"
              />
            </div>
          </div>

          {/* list */}
          {memLoading ? (
            <Skeleton />
          ) : entries.length === 0 ? (
            <EmptyState
              icon="memory"
              title="Nothing memorized yet"
              description={`Facts, goals and references saved here are injected into ${selectedAgent?.name ?? "the agent"}'s context when relevant. Add one above, or let the agent save notes via its memory_store tool.`}
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon="search"
              title="No matches"
              description="Nothing matches the current kind filter or search text."
              compact
            />
          ) : (
            <div className="stack-list" style={{ gap: 10, marginBottom: 8 }}>
              {filtered.map((entry) => (
                <article className="card memory-item" key={entry.id}>
                  <div className="grow">
                    <div className="chips">
                      <Badge tone={KIND_META[entry.kind].tone}>{entry.kind}</Badge>
                      <span className="meta num" title={entry.createdAt}>
                        {relTime(entry.createdAt)}
                      </span>
                    </div>
                    <p className="memory-content">{entry.content}</p>
                  </div>
                  <IconButton
                    icon="trash"
                    label={`Delete memory from ${entry.createdAt}`}
                    onClick={() => remove(entry)}
                  />
                </article>
              ))}
            </div>
          )}
        </>
      )}

      {confirm.element}
    </div>
  );
}
