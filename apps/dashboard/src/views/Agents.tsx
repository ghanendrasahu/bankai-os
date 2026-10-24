import { useCallback, useEffect, useMemo, useState } from "react";
import type { Agent } from "@bankai/contracts";
import { api } from "../api.js";
import { relTime, initials } from "../lib/format.js";
import { PROVIDERS, TOOL_CATALOG, parseModelRef, providerInfo } from "../lib/domain.js";
import { Button, IconButton } from "../components/ui/Button.js";
import { Badge, ChipSelect } from "../components/ui/Badge.js";
import { Field, Select, Switch, TextArea, TextInput } from "../components/ui/Field.js";
import { Dialog, useConfirm } from "../components/ui/Dialog.js";
import { EmptyState, Skeleton } from "../components/ui/Loading.js";
import { Alert } from "../components/ui/Alert.js";
import { Icon } from "../components/ui/Icon.js";
import { useToast } from "../components/ui/Toasts.js";

interface EditorState {
  open: boolean;
  id: string | null; // null → create
  name: string;
  description: string;
  systemPrompt: string;
  provider: string;
  model: string;
  tools: string[];
  customTool: string;
  enabled: boolean;
}

const EMPTY_EDITOR: EditorState = {
  open: false,
  id: null,
  name: "",
  description: "",
  systemPrompt: "",
  provider: "groq",
  model: "openai/gpt-oss-120b",
  tools: ["time"],
  customTool: "",
  enabled: true,
};

export function Agents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState>(EMPTY_EDITOR);
  const [errors, setErrors] = useState<{ name?: string; model?: string }>({});
  const [saving, setSaving] = useState(false);

  const toast = useToast();
  const confirm = useConfirm();

  const load = useCallback(async () => {
    try {
      setAgents(await api.get<Agent[]>("/agents"));
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

  function openCreate() {
    setEditor({ ...EMPTY_EDITOR, open: true });
    setErrors({});
  }

  function openEdit(agent: Agent) {
    const { provider, model } = parseModelRef(agent.model);
    setEditor({
      open: true,
      id: agent.id,
      name: agent.name,
      description: agent.description,
      systemPrompt: agent.systemPrompt,
      provider,
      model,
      tools: [...agent.tools],
      customTool: "",
      enabled: agent.enabled,
    });
    setErrors({});
  }

  function closeEditor() {
    setEditor((e) => ({ ...e, open: false }));
    setErrors({});
  }

  function validate(): boolean {
    const next: typeof errors = {};
    if (!editor.name.trim()) next.name = "Name is required";
    if (!editor.model.trim()) next.model = "Model is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function save() {
    if (!validate()) return;
    setSaving(true);
    const body = {
      name: editor.name.trim(),
      description: editor.description.trim(),
      systemPrompt: editor.systemPrompt,
      model: `${editor.provider}:${editor.model.replace(/^\w+:/, "")}`,
      tools: editor.tools,
      enabled: editor.enabled,
    };
    try {
      if (editor.id) {
        await api.patch(`/agents/${editor.id}`, body);
        toast.success(`Agent “${body.name}” updated`);
      } else {
        await api.post("/agents", body);
        toast.success(`Agent “${body.name}” created`);
      }
      closeEditor();
      await load();
    } catch (e) {
      setBanner((e as Error).message);
      setSaving(false);
    }
  }

  async function toggle(agent: Agent) {
    try {
      await api.patch(`/agents/${agent.id}`, { enabled: !agent.enabled });
      setAgents((list) => list.map((a) => (a.id === agent.id ? { ...a, enabled: !agent.enabled } : a)));
      toast.success(`${agent.name} ${agent.enabled ? "disabled" : "enabled"}`);
    } catch (e) {
      toast.error((e as Error).message);
      await load();
    }
  }

  function remove(agent: Agent) {
    confirm.ask({
      title: `Delete ${agent.name}?`,
      body: (
        <>
          Deleting an agent permanently removes its chats, memory, tasks and run history along with it
          (the database enforces this with cascading deletes). Consider disabling it instead.
        </>
      ),
      confirmLabel: "Delete agent",
      danger: true,
      onConfirm: async () => {
        try {
          await api.del(`/agents/${agent.id}`);
          toast.success(`Agent “${agent.name}” deleted`);
          await load();
        } catch (e) {
          toast.error((e as Error).message);
          throw e;
        }
      },
    });
  }

  const catalog = useMemo(() => TOOL_CATALOG.map((t) => t.name), []);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>
            <Icon name="agents" /> Agents
          </h1>
          <p className="page-sub">
            Define assistants: persona, model and the tools they may call.
          </p>
        </div>
        <div className="page-actions">
          <IconButton icon="refresh" label="Refresh agents" onClick={() => void load()} />
          <Button variant="primary" icon="plus" onClick={openCreate}>
            New agent
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
          title="No agents yet"
          description="An agent pairs a system prompt and model with a set of allowed tools. Create one to start chatting."
          action={
            <Button variant="primary" icon="plus" onClick={openCreate}>
              Create your first agent
            </Button>
          }
        />
      ) : (
        <div className="grid-cards">
          {agents.map((agent) => {
            const { provider } = parseModelRef(agent.model);
            const info = providerInfo(provider);
            return (
              <article className="card agent-card" key={agent.id} aria-label={agent.name}>
                <div className="agent-card-head">
                  <span className="avatar agent" aria-hidden="true">
                    {initials(agent.name)}
                  </span>
                  <div className="agent-name-line">
                    <h3 title={agent.name}>{agent.name}</h3>
                    <Badge tone={agent.enabled ? "ok" : "neutral"} icon={agent.enabled ? "check" : "close"}>
                      {agent.enabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </div>
                  <Switch
                    checked={agent.enabled}
                    onChange={() => void toggle(agent)}
                    label={`${agent.enabled ? "Disable" : "Enable"} ${agent.name}`}
                  />
                </div>

                {agent.description && <p className="agent-desc clamp-2">{agent.description}</p>}
                {agent.systemPrompt && !agent.description && (
                  <p className="agent-desc clamp-2">{agent.systemPrompt}</p>
                )}

                <div className="chips">
                  <span className="chip model-chip" title="provider : model">
                    {provider}:{parseModelRef(agent.model).model}
                  </span>
                  {info && <span className="chip">{info.label}</span>}
                </div>

                <div className="agent-tools">
                  <span className="meta">tools</span>
                  {agent.tools.length === 0 ? (
                    <span className="meta">none</span>
                  ) : (
                    agent.tools.slice(0, 5).map((t) => (
                      <span className="chip" key={t} title={TOOL_CATALOG.find((c) => c.name === t)?.description ?? t}>
                        {t}
                      </span>
                    ))
                  )}
                  {agent.tools.length > 5 && <span className="chip">+{agent.tools.length - 5}</span>}
                </div>

                <div className="agent-foot">
                  <span className="meta">Updated {relTime(agent.updatedAt)}</span>
                  <div className="agent-actions">
                    <IconButton icon="edit" label={`Edit ${agent.name}`} onClick={() => openEdit(agent)} />
                    <IconButton icon="trash" label={`Delete ${agent.name}`} onClick={() => remove(agent)} />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* ---- editor dialog ---- */}
      <Dialog
        open={editor.open}
        onClose={saving ? () => undefined : closeEditor}
        title={editor.id ? `Edit ${editor.name || "agent"}` : "New agent"}
        subtitle="Tool allowlists and the model string are validated by the API."
        wide
        footer={
          <>
            <span className="spacer" />
            <Button variant="ghost" onClick={closeEditor} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" loading={saving} onClick={() => void save()}>
              {editor.id ? "Save changes" : "Create agent"}
            </Button>
          </>
        }
      >
        <Field label="Name" required error={errors.name} htmlFor="agent-name" hint="Shown across the dashboard.">
          <TextInput
            id="agent-name"
            value={editor.name}
            maxLength={120}
            placeholder="e.g. Research assistant"
            onChange={(e) => setEditor((s) => ({ ...s, name: e.target.value }))}
          />
        </Field>

        <Field label="Description" htmlFor="agent-desc">
          <TextInput
            id="agent-desc"
            value={editor.description}
            maxLength={1000}
            placeholder="What is this agent for?"
            onChange={(e) => setEditor((s) => ({ ...s, description: e.target.value }))}
          />
        </Field>

        <Field
          label="System prompt"
          htmlFor="agent-prompt"
          hint="Persona and behavioural instructions prepended to every request."
        >
          <TextArea
            id="agent-prompt"
            rows={5}
            value={editor.systemPrompt}
            onChange={(e) => setEditor((s) => ({ ...s, systemPrompt: e.target.value }))}
            placeholder="You are…"
          />
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 10 }}>
          <Field label="Provider" htmlFor="agent-provider">
            <Select
              id="agent-provider"
              value={editor.provider}
              onChange={(e) => setEditor((s) => ({ ...s, provider: e.target.value }))}
            >
              {PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Model"
            required
            error={errors.model}
            htmlFor="agent-model"
            hint={`${providerInfo(editor.provider)?.hint ?? ""} Stored as provider:model.`}
          >
            <TextInput
              id="agent-model"
              value={editor.model}
              list="model-suggestions"
              onChange={(e) => setEditor((s) => ({ ...s, model: e.target.value }))}
              placeholder="model id"
            />
            <datalist id="model-suggestions">
              <option value="openai/gpt-oss-120b" />
              <option value="openai/gpt-oss-20b" />
              <option value="llama-3.3-70b-versatile" />
            </datalist>
          </Field>
        </div>

        <Field
          label="Allowed tools"
          hint="Only enabled tools reach the model. Unknown names entered below are sent as-is (the runtime refuses them if not in the registry)."
        >
          <div className="tool-pick-grid" role="group" aria-label="Allowed tools">
            {TOOL_CATALOG.map((t) => (
              <ChipSelect
                key={t.name}
                aria-pressed={editor.tools.includes(t.name)}
                title={t.description}
                onClick={() =>
                  setEditor((s) => ({
                    ...s,
                    tools: s.tools.includes(t.name) ? s.tools.filter((x) => x !== t.name) : [...s.tools, t.name],
                  }))
                }
              >
                {t.name}
              </ChipSelect>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <TextInput
              value={editor.customTool}
              className=""
              placeholder="Add a custom tool name…"
              aria-label="Custom tool name"
              onChange={(e) => setEditor((s) => ({ ...s, customTool: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const t = editor.customTool.trim();
                  if (t && !catalog.includes(editor.customTool.trim()) && !editor.tools.includes(t)) {
                    setEditor((s) => ({ ...s, tools: [...s.tools, t], customTool: "" }));
                  }
                }
              }}
            />
          </div>
          {editor.tools.some((t) => !catalog.includes(t)) && (
            <div className="chips" style={{ marginTop: 8 }}>
              {editor.tools
                .filter((t) => !catalog.includes(t))
                .map((t) => (
                  <button
                    key={t}
                    type="button"
                    className="chip active"
                    onClick={() => setEditor((s) => ({ ...s, tools: s.tools.filter((x) => x !== t) }))}
                    title="Remove"
                  >
                    {t} <Icon name="close" size={11} />
                  </button>
                ))}
            </div>
          )}
        </Field>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Switch
            checked={editor.enabled}
            onChange={() => setEditor((s) => ({ ...s, enabled: !s.enabled }))}
            label="Agent enabled"
          />
          <span style={{ fontSize: "var(--fs-sm)", color: "var(--text-2)" }}>
            {editor.enabled ? "Enabled — can run chats and tasks" : "Disabled — runs will be rejected"}
          </span>
        </div>
      </Dialog>

      {confirm.element}
    </div>
  );
}
