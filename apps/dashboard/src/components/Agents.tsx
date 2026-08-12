import { useCallback, useEffect, useState } from "react";
import type { Agent } from "@bankai/contracts";
import { api } from "../api.js";

const EMPTY_FORM = {
  name: "",
  description: "",
  systemPrompt: "",
  model: "groq:llama-3.3-70b-versatile",
  tools: "",
  enabled: true,
};

export function Agents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setAgents(await api.get<Agent[]>("/agents"));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const body = {
      name: form.name,
      description: form.description,
      systemPrompt: form.systemPrompt,
      model: form.model,
      tools: form.tools
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      enabled: form.enabled,
    };
    try {
      if (editingId) await api.patch(`/agents/${editingId}`, body);
      else await api.post("/agents", body);
      setForm(EMPTY_FORM);
      setEditingId(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function toggle(agent: Agent) {
    try {
      await api.patch(`/agents/${agent.id}`, { enabled: !agent.enabled });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function remove(agent: Agent) {
    if (!confirm(`Delete agent "${agent.name}"?`)) return;
    try {
      await api.del(`/agents/${agent.id}`);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function edit(agent: Agent) {
    setEditingId(agent.id);
    setForm({
      name: agent.name,
      description: agent.description,
      systemPrompt: agent.systemPrompt,
      model: agent.model,
      tools: agent.tools.join(", "),
      enabled: agent.enabled,
    });
  }

  return (
    <div className="panel">
      <h2>Agents</h2>
      {error && <p className="error">{error}</p>}
      <form className="agent-form" onSubmit={save}>
        <h3>{editingId ? "Edit agent" : "New agent"}</h3>
        <label>
          Name
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </label>
        <label>
          Description
          <input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </label>
        <label>
          System prompt
          <textarea
            rows={3}
            value={form.systemPrompt}
            onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
          />
        </label>
        <label>
          Model
          <input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
        </label>
        <label>
          Tools (comma-separated: time, memory_store, memory_search, memory_list)
          <input value={form.tools} onChange={(e) => setForm({ ...form, tools: e.target.value })} />
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
          />
          Enabled
        </label>
        <div className="row">
          <button type="submit">{editingId ? "Save changes" : "Create agent"}</button>
          {editingId && (
            <button
              type="button"
              className="ghost"
              onClick={() => {
                setEditingId(null);
                setForm(EMPTY_FORM);
              }}
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <ul className="list">
        {agents.map((agent) => (
          <li key={agent.id} className="card">
            <div>
              <strong>{agent.name}</strong>{" "}
              <span className={agent.enabled ? "badge ok" : "badge"}>{agent.enabled ? "enabled" : "disabled"}</span>
              <div className="muted">{agent.model}</div>
              {agent.tools.length > 0 && <div className="muted">tools: {agent.tools.join(", ")}</div>}
              {agent.systemPrompt && <p className="muted">{agent.systemPrompt.slice(0, 120)}</p>}
            </div>
            <div className="row">
              <button className="ghost" onClick={() => toggle(agent)}>
                {agent.enabled ? "Disable" : "Enable"}
              </button>
              <button className="ghost" onClick={() => edit(agent)}>
                Edit
              </button>
              <button className="ghost danger" onClick={() => remove(agent)}>
                Delete
              </button>
            </div>
          </li>
        ))}
        {agents.length === 0 && <p className="muted">No agents yet. Create one to start chatting.</p>}
      </ul>
    </div>
  );
}