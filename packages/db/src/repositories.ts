import type {
  Agent,
  AgentInput,
  Conversation,
  ConversationInput,
  Memory,
  MemoryInput,
  Message,
  MessageInput,
  Run,
  RunEvent,
  RunStatus,
  SettingsEntries,
  Task,
  TaskInput,
} from "@bankai/contracts";
import { newId } from "@bankai/contracts";
import type { Database } from "better-sqlite3";

export interface AgentRow {
  id: string;
  name: string;
  description: string;
  system_prompt: string;
  model: string;
  tools: string;
  enabled: number;
  created_at: string;
  updated_at: string;
}

export function mapAgent(row: AgentRow): Agent {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    systemPrompt: row.system_prompt,
    model: row.model,
    tools: JSON.parse(row.tools) as string[],
    enabled: row.enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class AgentsRepository {
  constructor(protected readonly db: Database) {}

  list(enabledOnly = false): Agent[] {
    const sql = enabledOnly
      ? "SELECT * FROM agents WHERE enabled = 1 ORDER BY name ASC"
      : "SELECT * FROM agents ORDER BY name ASC";
    return (this.db.prepare(sql).all() as AgentRow[]).map(mapAgent);
  }

  byId(id: string): Agent | undefined {
    const row = this.db.prepare("SELECT * FROM agents WHERE id = ?").get(id) as
      | AgentRow
      | undefined;
    return row ? mapAgent(row) : undefined;
  }

  create(input: AgentInput): Agent {
    const now = new Date().toISOString();
    const id = newId("ag");
    this.db
      .prepare(
        `INSERT INTO agents (id, name, description, system_prompt, model, tools, enabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.name,
        input.description,
        input.systemPrompt,
        input.model,
        JSON.stringify(input.tools),
        input.enabled ? 1 : 0,
        now,
        now
      );
    return this.byId(id) as Agent;
  }

  update(id: string, patch: Partial<AgentInput>): Agent | undefined {
    const existing = this.byId(id);
    if (!existing) return undefined;
    const next = { ...existing, ...patch };
    this.db
      .prepare(
        `UPDATE agents SET name = ?, description = ?, system_prompt = ?, model = ?, tools = ?, enabled = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(
        next.name,
        next.description,
        next.systemPrompt,
        next.model,
        JSON.stringify(next.tools),
        next.enabled ? 1 : 0,
        new Date().toISOString(),
        id
      );
    return this.byId(id);
  }

  remove(id: string): boolean {
    return this.db.prepare("DELETE FROM agents WHERE id = ?").run(id).changes > 0;
  }
}

export interface ConversationRow {
  id: string;
  agent_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export function mapConversation(row: ConversationRow): Conversation {
  return {
    id: row.id,
    agentId: row.agent_id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class ConversationsRepository {
  constructor(protected readonly db: Database) {}

  list(agentId?: string): Conversation[] {
    const sql = agentId
      ? "SELECT * FROM conversations WHERE agent_id = ? ORDER BY updated_at DESC"
      : "SELECT * FROM conversations ORDER BY updated_at DESC";
    const rows = agentId
      ? (this.db.prepare(sql).all(agentId) as ConversationRow[])
      : (this.db.prepare(sql).all() as ConversationRow[]);
    return rows.map(mapConversation);
  }

  byId(id: string): Conversation | undefined {
    const row = this.db
      .prepare("SELECT * FROM conversations WHERE id = ?")
      .get(id) as ConversationRow | undefined;
    return row ? mapConversation(row) : undefined;
  }

  create(input: ConversationInput): Conversation {
    const now = new Date().toISOString();
    const id = newId("ch");
    this.db
      .prepare(
        `INSERT INTO conversations (id, agent_id, title, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(id, input.agentId, input.title, now, now);
    return this.byId(id) as Conversation;
  }

  touch(id: string): void {
    this.db
      .prepare("UPDATE conversations SET updated_at = ? WHERE id = ?")
      .run(new Date().toISOString(), id);
  }

  rename(id: string, title: string): Conversation | undefined {
    const existing = this.byId(id);
    if (!existing) return undefined;
    this.db
      .prepare("UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?")
      .run(title, new Date().toISOString(), id);
    return this.byId(id);
  }

  remove(id: string): boolean {
    return this.db.prepare("DELETE FROM conversations WHERE id = ?").run(id).changes > 0;
  }
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  tool_calls: string | null;
  created_at: string;
}

export function mapMessage(row: MessageRow): Message {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role as Message["role"],
    content: row.content,
    toolCalls: row.tool_calls ? JSON.parse(row.tool_calls) : null,
    createdAt: row.created_at,
  };
}

export class MessagesRepository {
  constructor(protected readonly db: Database) {}

  listByConversation(conversationId: string): Message[] {
    const rows = this.db
      .prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC")
      .all(conversationId) as MessageRow[];
    return rows.map(mapMessage);
  }

  byId(id: string): Message | undefined {
    const row = this.db
      .prepare("SELECT * FROM messages WHERE id = ?")
      .get(id) as MessageRow | undefined;
    return row ? mapMessage(row) : undefined;
  }

  create(input: MessageInput): Message {
    const now = new Date().toISOString();
    const id = newId("msg");
    this.db
      .prepare(
        `INSERT INTO messages (id, conversation_id, role, content, tool_calls, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.conversationId,
        input.role,
        input.content,
        input.toolCalls ? JSON.stringify(input.toolCalls) : null,
        now
      );
    return this.byId(id) as Message;
  }

  removeByConversation(conversationId: string): number {
    return this.db
      .prepare("DELETE FROM messages WHERE conversation_id = ?")
      .run(conversationId).changes;
  }
}

export interface RunRow {
  id: string;
  agent_id: string;
  conversation_id: string | null;
  request_id: string | null;
  prompt: string;
  status: string;
  error: string | null;
  events: string;
  started_at: string;
  finished_at: string | null;
}

export function mapRun(row: RunRow): Run {
  return {
    id: row.id,
    agentId: row.agent_id,
    conversationId: row.conversation_id,
    requestId: row.request_id,
    prompt: row.prompt,
    status: row.status as RunStatus,
    events: JSON.parse(row.events) as RunEvent[],
    error: row.error,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  };
}

export interface CreateRunInput {
  id: string;
  agentId: string;
  conversationId: string | null;
  requestId: string | null;
  prompt: string;
}

export class RunsRepository {
  constructor(protected readonly db: Database) {}

  list(agentId?: string, limit = 50): Run[] {
    const sql =
      `SELECT * FROM runs ${agentId ? "WHERE agent_id = ?" : ""}` +
      ` ORDER BY started_at DESC LIMIT ${Math.max(1, Math.min(limit, 500))}`;
    const rows = agentId
      ? (this.db.prepare(sql).all(agentId) as RunRow[])
      : (this.db.prepare(sql).all() as RunRow[]);
    return rows.map(mapRun);
  }

  byId(id: string): Run | undefined {
    const row = this.db
      .prepare("SELECT * FROM runs WHERE id = ?")
      .get(id) as RunRow | undefined;
    return row ? mapRun(row) : undefined;
  }

  byRequestId(requestId: string): Run | undefined {
    const row = this.db
      .prepare("SELECT * FROM runs WHERE request_id = ?")
      .get(requestId) as RunRow | undefined;
    return row ? mapRun(row) : undefined;
  }

  create(input: CreateRunInput): Run {
    const now = new Date().toISOString();
    const status: RunStatus = "queued";
    const events: RunEvent[] = [{ type: "queued", at: now }];
    this.db
      .prepare(
        `INSERT INTO runs
           (id, agent_id, conversation_id, request_id, prompt, status, events, started_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.id,
        input.agentId,
        input.conversationId,
        input.requestId,
        input.prompt,
        status,
        JSON.stringify(events),
        now
      );
    return this.byId(input.id) as Run;
  }

  setStatus(id: string, status: RunStatus, error?: string): Run | undefined {
    const finishedAt =
      status === "completed" || status === "failed" || status === "cancelled" || status === "interrupted"
        ? new Date().toISOString()
        : null;
    this.db
      .prepare("UPDATE runs SET status = ?, error = ?, finished_at = ? WHERE id = ?")
      .run(status, error ?? null, finishedAt, id);
    return this.byId(id);
  }

  appendEvent(id: string, event: RunEvent): Run | undefined {
    const run = this.byId(id);
    if (!run) return undefined;
    const events = JSON.stringify([...run.events, event]);
    this.db
      .prepare("UPDATE runs SET events = ?, status = ? WHERE id = ?")
      .run(events, event.type === "cancelled" ? "cancelled" : run.status, id);
    return this.byId(id);
  }

  appendTextDelta(id: string, text: string): void {
    const run = this.byId(id);
    if (!run) return;
    let events = run.events;
    const last = events[events.length - 1];
    if (last?.type === "delta") {
      // Merge consecutive deltas so the audit log stays compact.
      events = [
        ...events.slice(0, -1),
        { ...last, text: last.text + text },
      ];
    } else {
      events = [...events, { type: "delta", text, at: new Date().toISOString() }];
    }
    this.db
      .prepare("UPDATE runs SET events = ? WHERE id = ?")
      .run(JSON.stringify(events), id);
  }

  markInterruptedInFlight(): number {
    const result = this.db
      .prepare(
        `UPDATE runs SET status = 'interrupted', error = 'process restarted',
           events = json_set(events, '$[#]', json_object('type','interrupted','at',?)), finished_at = ?
         WHERE status IN ('queued', 'running')`
      )
      .run(new Date().toISOString(), new Date().toISOString());
    return result.changes;
  }
}

export interface TaskRow {
  id: string;
  agent_id: string;
  name: string;
  cron: string;
  prompt: string;
  enabled: number;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
}

export function mapTask(row: TaskRow): Task {
  return {
    id: row.id,
    agentId: row.agent_id,
    name: row.name,
    cron: row.cron,
    prompt: row.prompt,
    enabled: row.enabled === 1,
    lastRunAt: row.last_run_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class TasksRepository {
  constructor(protected readonly db: Database) {}

  list(enabledOnly = false): Task[] {
    const sql = enabledOnly
      ? "SELECT * FROM tasks WHERE enabled = 1 ORDER BY name ASC"
      : "SELECT * FROM tasks ORDER BY name ASC";
    return (this.db.prepare(sql).all() as TaskRow[]).map(mapTask);
  }

  byId(id: string): Task | undefined {
    const row = this.db
      .prepare("SELECT * FROM tasks WHERE id = ?")
      .get(id) as TaskRow | undefined;
    return row ? mapTask(row) : undefined;
  }

  create(input: TaskInput): Task {
    const now = new Date().toISOString();
    const id = newId("task");
    this.db
      .prepare(
        `INSERT INTO tasks (id, agent_id, name, cron, prompt, enabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(id, input.agentId, input.name, input.cron, input.prompt, input.enabled ? 1 : 0, now, now);
    return this.byId(id) as Task;
  }

  update(id: string, patch: Partial<TaskInput>): Task | undefined {
    const existing = this.byId(id);
    if (!existing) return undefined;
    const next = { ...existing, ...patch };
    this.db
      .prepare("UPDATE tasks SET name = ?, cron = ?, prompt = ?, enabled = ?, updated_at = ? WHERE id = ?")
      .run(next.name, next.cron, next.prompt, next.enabled ? 1 : 0, new Date().toISOString(), id);
    return this.byId(id);
  }

  setLastRun(id: string, at: string): void {
    this.db
      .prepare("UPDATE tasks SET last_run_at = ?, updated_at = ? WHERE id = ?")
      .run(at, at, id);
  }

  remove(id: string): boolean {
    return this.db.prepare("DELETE FROM tasks WHERE id = ?").run(id).changes > 0;
  }
}

export interface MemoryRow {
  id: string;
  agent_id: string;
  kind: string;
  content: string;
  created_at: string;
}

export function mapMemory(row: MemoryRow): Memory {
  return {
    id: row.id,
    agentId: row.agent_id,
    kind: row.kind as Memory["kind"],
    content: row.content,
    createdAt: row.created_at,
  };
}

export class MemoryRepository {
  constructor(protected readonly db: Database) {}

  list(agentId: string, limit = 100): Memory[] {
    return (
      this.db
        .prepare(
          "SELECT * FROM memory WHERE agent_id = ? ORDER BY created_at DESC LIMIT ?"
        )
        .all(agentId, Math.max(1, Math.min(limit, 500))) as MemoryRow[]
    ).map(mapMemory);
  }

  byId(id: string): Memory | undefined {
    const row = this.db
      .prepare("SELECT * FROM memory WHERE id = ?")
      .get(id) as MemoryRow | undefined;
    return row ? mapMemory(row) : undefined;
  }

  search(agentId: string, query: string, limit = 5): Memory[] {
    const terms = query
      .split(/\s+/)
      .filter((term) => term.length > 0)
      .slice(0, 8)
      .map((term) => `"${term.replaceAll('"', '""')}"`);
    if (terms.length === 0) return [];
    const match = terms.join(" AND ");
    const rows = this.db
      .prepare(
        `SELECT m.id, m.agent_id, m.kind, m.content, m.created_at
         FROM memory_fts f
         JOIN memory m ON m.rowid = f.rowid
         WHERE m.agent_id = ? AND memory_fts MATCH ?
         ORDER BY rank
         LIMIT ?`
      )
      .all(agentId, match, Math.max(1, Math.min(limit, 20))) as MemoryRow[];
    return rows.map(mapMemory);
  }

  create(input: MemoryInput): Memory {
    const now = new Date().toISOString();
    const id = newId("mem");
    this.db
      .prepare("INSERT INTO memory (id, agent_id, kind, content, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(id, input.agentId, input.kind, input.content, now);
    return this.byId(id) as Memory;
  }

  remove(id: string): boolean {
    return this.db.prepare("DELETE FROM memory WHERE id = ?").run(id).changes > 0;
  }

  removeByAgent(agentId: string): number {
    return this.db.prepare("DELETE FROM memory WHERE agent_id = ?").run(agentId).changes;
  }
}

export class SettingsRepository {
  constructor(protected readonly db: Database) {}

  all(): SettingsEntries {
    const rows = this.db
      .prepare("SELECT key, value FROM settings ORDER BY key ASC")
      .all() as Array<{ key: string; value: string }>;
    const entries: SettingsEntries = {};
    for (const row of rows) entries[row.key] = row.value;
    return entries;
  }

  get(key: string): string | undefined {
    const row = this.db
      .prepare("SELECT value FROM settings WHERE key = ?")
      .get(key) as { value: string } | undefined;
    return row?.value;
  }

  set(key: string, value: string): void {
    this.db
      .prepare(
        "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
      )
      .run(key, value);
  }

  setMany(entries: SettingsEntries): void {
    const tx = this.db.transaction(() => {
      for (const [key, value] of Object.entries(entries)) {
        this.set(key, value);
      }
    });
    tx();
  }

  delete(key: string): boolean {
    return this.db.prepare("DELETE FROM settings WHERE key = ?").run(key).changes > 0;
  }
}