import { useCallback, useEffect, useMemo, useState } from "react";
import type { Agent, Task } from "@bankai/contracts";
import { api } from "../api.js";
import { relTime } from "../lib/format.js";
import { CRON_EXAMPLES } from "../lib/domain.js";
import { Button, IconButton } from "../components/ui/Button.js";
import { Badge } from "../components/ui/Badge.js";
import { Field, Select, Switch, TextArea, TextInput } from "../components/ui/Field.js";
import { Dialog, useConfirm } from "../components/ui/Dialog.js";
import { EmptyState, Skeleton } from "../components/ui/Loading.js";
import { Alert } from "../components/ui/Alert.js";
import { Icon } from "../components/ui/Icon.js";
import { useToast } from "../components/ui/Toasts.js";

interface EditorState {
  open: boolean;
  id: string | null;
  name: string;
  agentId: string;
  cron: string;
  prompt: string;
  enabled: boolean;
}

const EMPTY: EditorState = {
  open: false,
  id: null,
  name: "",
  agentId: "",
  cron: "0 * * * *",
  prompt: "",
  enabled: true,
};

/** Cron fields must be 5 or 6 space-separated fields (node-cron); we only shape-check here. */
function cronLooksPlausible(cron: string): boolean {
  const t = cron.trim();
  if (!t) return false;
  if (t.startsWith("@")) return true; // @hourly etc.
  const fields = t.split(/\s+/).length;
  return fields === 5 || fields === 6;
}

export function Tasks() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState>(EMPTY);
  const [errors, setErrors] = useState<{ name?: string; agent?: string; cron?: string; prompt?: string }>({});
  const [saving, setSaving] = useState(false);

  const toast = useToast();
  const confirm = useConfirm();

  const load = useCallback(async () => {
    try {
      const [agentList, taskList] = await Promise.all([api.get<Agent[]>("/agents"), api.get<Task[]>("/tasks")]);
      setAgents(agentList);
      setTasks(taskList);
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

  const agentName = useCallback(
    (id: string) => agents.find((a) => a.id === id)?.name ?? "deleted agent",
    [agents]
  );

  function openCreate() {
    setEditor({
      ...EMPTY,
      open: true,
      agentId: agents[0]?.id ?? "",
    });
    setErrors({});
  }

  function openEdit(task: Task) {
    setEditor({
      open: true,
      id: task.id,
      name: task.name,
      agentId: task.agentId,
      cron: task.cron,
      prompt: task.prompt,
      enabled: task.enabled,
    });
    setErrors({});
  }

  function closeEditor() {
    setEditor((s) => ({ ...s, open: false }));
    setErrors({});
  }

  function validate(): boolean {
    const next: typeof errors = {};
    if (!editor.name.trim()) next.name = "Name is required";
    if (!editor.agentId) next.agent = "Pick an agent";
    if (!cronLooksPlausible(editor.cron)) next.cron = "Cron needs 5 or 6 space-separated fields";
    if (!editor.prompt.trim()) next.prompt = "Prompt is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function save() {
    if (!validate()) return;
    setSaving(true);
    const body = {
      agentId: editor.agentId,
      name: editor.name.trim(),
      cron: editor.cron.trim(),
      prompt: editor.prompt.trim(),
      enabled: editor.enabled,
    };
    try {
      if (editor.id) {
        await api.patch(`/tasks/${editor.id}`, body);
        toast.success(`Task “${body.name}” updated`);
      } else {
        await api.post("/tasks", body);
        toast.success(`Task “${body.name}” scheduled`);
      }
      closeEditor();
      await load();
    } catch (e) {
      setBanner((e as Error).message);
      setSaving(false);
    }
  }

  async function toggle(task: Task) {
    try {
      await api.patch(`/tasks/${task.id}`, { enabled: !task.enabled });
      setTasks((list) => list.map((t) => (t.id === task.id ? { ...t, enabled: !task.enabled } : t)));
      toast.success(`${task.name} ${task.enabled ? "paused" : "resumed"}`);
    } catch (e) {
      toast.error((e as Error).message);
      await load();
    }
  }

  function remove(task: Task) {
    confirm.ask({
      title: `Delete ${task.name}?`,
      body: "The task will stop firing immediately. Past runs triggered by it stay in the run history.",
      confirmLabel: "Delete task",
      danger: true,
      onConfirm: async () => {
        try {
          await api.del(`/tasks/${task.id}`);
          toast.success(`Task “${task.name}” deleted`);
          await load();
        } catch (e) {
          toast.error((e as Error).message);
          throw e;
        }
      },
    });
  }

  const sorted = useMemo(
    () => [...tasks].sort((a, b) => (a.enabled === b.enabled ? a.name.localeCompare(b.name) : a.enabled ? -1 : 1)),
    [tasks]
  );

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>
            <Icon name="tasks" /> Tasks
          </h1>
          <p className="page-sub">
            Cron-scheduled prompts the server runs autonomously, even while the dashboard is closed.
          </p>
        </div>
        <div className="page-actions">
          <IconButton icon="refresh" label="Refresh tasks" onClick={() => void load()} />
          <Button variant="primary" icon="plus" onClick={openCreate} disabled={agents.length === 0}>
            New task
          </Button>
        </div>
      </header>

      {banner && (
        <Alert kind="error" onClose={() => setBanner(null)}>
          {banner}
        </Alert>
      )}

      {loading ? (
        <Skeleton />
      ) : agents.length === 0 ? (
        <EmptyState
          icon="agents"
          title="Create an agent first"
          description="Tasks run prompts through an agent on a cron schedule — you need at least one enabled agent."
        />
      ) : sorted.length === 0 ? (
        <EmptyState
          icon="tasks"
          title="No scheduled tasks"
          description="Schedule a prompt to run on a cadence — for example a daily status summary from one of your agents."
          action={
            <Button variant="primary" icon="plus" onClick={openCreate}>
              Schedule your first task
            </Button>
          }
        />
      ) : (
        <div className="stack-list" style={{ gap: 10 }}>
          {sorted.map((task) => (
            <article className="card task-row" key={task.id} aria-label={task.name}>
              <div className="task-top">
                <div className="task-top-left">
                  <h3>{task.name}</h3>
                  <div className="chips">
                    <span className="chip task-cron" title="Cron schedule">
                      <Icon name="clock" size={11} /> {task.cron}
                    </span>
                    <span className="chip">{agentName(task.agentId)}</span>
                    <Badge tone={task.enabled ? "ok" : "neutral"}>{task.enabled ? "Active" : "Paused"}</Badge>
                  </div>
                </div>
                <div className="task-actions">
                  <Switch
                    checked={task.enabled}
                    onChange={() => void toggle(task)}
                    label={`${task.enabled ? "Pause" : "Resume"} ${task.name}`}
                  />
                  <IconButton icon="edit" label={`Edit ${task.name}`} onClick={() => openEdit(task)} />
                  <IconButton icon="trash" label={`Delete ${task.name}`} onClick={() => remove(task)} />
                </div>
              </div>

              <p className="task-prompt clamp-2">{task.prompt}</p>

              <div className="task-meta-row">
                <span className="kv">
                  <Icon name="clock" size={12} />
                  Last fired {task.lastRunAt ? relTime(task.lastRunAt) : "never"}
                </span>
                <span className="kv">Created {relTime(task.createdAt)}</span>
              </div>
            </article>
          ))}
        </div>
      )}

      <Dialog
        open={editor.open}
        onClose={saving ? () => undefined : closeEditor}
        title={editor.id ? `Edit ${editor.name || "task"}` : "New scheduled task"}
        subtitle="The server fires the task's prompt through the selected agent's runtime."
        footer={
          <>
            <span className="spacer" />
            <Button variant="ghost" onClick={closeEditor} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" loading={saving} onClick={() => void save()}>
              {editor.id ? "Save changes" : "Schedule task"}
            </Button>
          </>
        }
      >
        <Field label="Name" required error={errors.name} htmlFor="task-name">
          <TextInput
            id="task-name"
            value={editor.name}
            maxLength={200}
            placeholder="e.g. Morning inbox summary"
            onChange={(e) => setEditor((s) => ({ ...s, name: e.target.value }))}
          />
        </Field>

        <Field label="Agent" required error={errors.agent} htmlFor="task-agent">
          <Select
            id="task-agent"
            value={editor.agentId}
            onChange={(e) => setEditor((s) => ({ ...s, agentId: e.target.value }))}
            disabled={editor.id !== null}
          >
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.enabled ? "" : " (disabled)"}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Cron schedule"
          required
          error={errors.cron}
          htmlFor="task-cron"
          hint="Standard cron (minute hour day month weekday). Invalid expressions simply never fire — check “Last fired” after a cycle."
        >
          <TextInput
            id="task-cron"
            style={{ fontFamily: "var(--mono)" }}
            value={editor.cron}
            onChange={(e) => setEditor((s) => ({ ...s, cron: e.target.value }))}
            placeholder="0 9 * * *"
          />
          <div className="cron-examples">
            {CRON_EXAMPLES.map((ex) => (
              <button
                key={ex.expression}
                type="button"
                className="chip chip-select"
                onClick={() => setEditor((s) => ({ ...s, cron: ex.expression }))}
                title={ex.description}
              >
                {ex.expression} · {ex.description}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Prompt" required error={errors.prompt} htmlFor="task-prompt" hint="Runs standalone (no chat history).">
          <TextArea
            id="task-prompt"
            rows={4}
            value={editor.prompt}
            onChange={(e) => setEditor((s) => ({ ...s, prompt: e.target.value }))}
            placeholder="What should the agent do on each fire?"
          />
        </Field>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Switch
            checked={editor.enabled}
            onChange={() => setEditor((s) => ({ ...s, enabled: !s.enabled }))}
            label="Task enabled"
          />
          <span style={{ fontSize: "var(--fs-sm)", color: "var(--text-2)" }}>
            {editor.enabled ? "Active — runs when its schedule fires" : "Paused — kept but not firing"}
          </span>
        </div>
      </Dialog>

      {confirm.element}
    </div>
  );
}
