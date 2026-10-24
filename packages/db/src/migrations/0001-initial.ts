import type { Database } from "better-sqlite3";
import type { Migration } from "./runner.js";

const INITIAL_SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agents (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  system_prompt TEXT NOT NULL DEFAULT '',
  model         TEXT NOT NULL DEFAULT 'groq:llama-3.3-70b-versatile',
  tools         TEXT NOT NULL DEFAULT '[]',
  enabled       INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS conversations (
  id         TEXT PRIMARY KEY,
  agent_id   TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  title      TEXT NOT NULL DEFAULT 'New chat',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL,
  content         TEXT NOT NULL DEFAULT '',
  tool_calls      TEXT,
  created_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS runs (
  id              TEXT PRIMARY KEY,
  agent_id        TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  conversation_id TEXT REFERENCES conversations(id) ON DELETE SET NULL,
  request_id      TEXT,
  prompt          TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'queued',
  error           TEXT,
  events          TEXT NOT NULL DEFAULT '[]',
  started_at      TEXT NOT NULL,
  finished_at     TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_runs_request ON runs(request_id) WHERE request_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS tasks (
  id          TEXT PRIMARY KEY,
  agent_id    TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  cron        TEXT NOT NULL,
  prompt      TEXT NOT NULL,
  enabled     INTEGER NOT NULL DEFAULT 1,
  last_run_at TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS memory (
  id         TEXT PRIMARY KEY,
  agent_id   TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL DEFAULT 'note',
  content    TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_conversations_agent ON conversations(agent_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_runs_agent ON runs(agent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_agent ON tasks(agent_id);
CREATE INDEX IF NOT EXISTS idx_memory_agent ON memory(agent_id);
CREATE INDEX IF NOT EXISTS idx_memory_created ON memory(created_at);
`;

export const initialMigration: Migration = {
  version: 1,
  name: "0001-initial",
  up(db) {
    db.exec(INITIAL_SCHEMA);
  },
};