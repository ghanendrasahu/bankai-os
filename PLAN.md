# Bankai OS — End-to-End Plan (8 Phases)

Personal autonomous agent platform. Monorepo: `packages/*` for shared libs,
`apps/*` for server + dashboard. DB: SQLite via `@bankai/db` (better-sqlite3, WAL).

## Phase 1 — Foundation ✅
- Monorepo workspaces, `tsconfig.base.json`, root scripts (build/typecheck/lint/dev)
- `@bankai/db`: schema (settings, agents, conversations, messages, runs, tasks, memory)
- Default model: `groq:llama-3.3-70b-versatile`

## Phase 2 — Server core
- `apps/server` (@bankai/server): Fastify + TypeScript, REST API over `@bankai/db`
- CRUD: agents, conversations, messages, runs, tasks, memory; settings read/write
- Health endpoint, JSON logging, structured errors

## Phase 3 — Agent runtime
- Run lifecycle: create run → stream model → persist messages/events → finish
- Provider adapter interface; Groq implementation (OpenAI-compatible)
- Tool calling framework + first tools (time, web-search later)

## Phase 4 — Dashboard UI
- `apps/dashboard` (@bankai/dashboard): React + Vite + TypeScript
- Chat view (create conversation, stream messages)
- Agent manager (create/edit/disable agents), run history viewer

## Phase 5 — Tasks scheduler
- Cron scheduling (node-cron) on top of `tasks` table
- Executes prompt via agent runtime, records `last_run_at` + runs

## Phase 6 — Memory & context
- Memory CRUD endpoints; note-taking from agent output
- Keyword/tag retrieval to inject relevant memory into prompts

## Phase 7 — Multi-provider
- Provider abstraction: Groq, OpenAI, local (LM Studio)
- Model selection per agent; API keys stored in `settings` (env-overridable)

## Phase 8 — Hardening & ship
- Auth (API token), rate limiting, input validation
- Backup/restore of the SQLite file; migrations path
- Unit/integration tests, lint gate, docs (README, API reference)

## Cross-cutting
- Every phase: build + typecheck + lint must pass before moving on
- All secrets via env, never in code