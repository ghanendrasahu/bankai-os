# Bankai OS — End-to-End Plan (8 Phases)

Personal autonomous agent platform. Monorepo: `packages/*` for shared libs,
`apps/*` for server + dashboard. DB: SQLite via `@bankai/db` (better-sqlite3, WAL).

## Architecture (locked)
- **Single process**: server serves the dashboard's static build → one Node process; SQLite stays safe (single-writer).
- **Repository layer** (`@bankai/db`): every query behind typed repos. SQLite now, Postgres later = config swap.
- **SSE, not WebSockets**: run streaming over Server-Sent Events — tunnel/proxy friendly, auto-reconnect, mobile-friendly.
- **Idempotency + state machine**: runs move `queued → running → completed|failed|cancelled`; events appended as audit log; duplicate submits rejected via `request_id`.
- **Crash-safe**: on boot, lingering `running` runs marked interrupted; WAL + busy_timeout.
- **Zero secrets in code**: zod-validated env config in `@bankai/config`.

## Git workflow
- Every commit authored as `ghanendrasahu` (identity set in global git config).
- Commit-per-feature: each meaningful milestone gets its own commit; pushed to `origin/main` (`github.com/ghanendrasahu/bankai-os`, private).

## Phase 1 — Foundation ✅
- Monorepo workspaces, `tsconfig.base.json`, root scripts (build/typecheck/lint/dev)
- `@bankai/db`: schema (settings, agents, conversations, messages, runs, tasks, memory)
- Default model: `opencode:glm-5.3-flash` (OpenCode Zen; the `*-free` models are gated to OpenCode's own client and cannot be called with an API key)

## Phase 2 — Contracts & data layer
- `@bankai/contracts`: shared zod DTOs, IDs, run state machine types — single source of truth for server + dashboard
- `@bankai/config`: zod-validated env config
- `@bankai/db`: versioned migrations runner, typed repositories (agents, conversations, messages, runs, tasks, memory, settings), backup helper (`VACUUM INTO`)

## Phase 3 — Server core
- `apps/server` (@bankai/server): Fastify + TypeScript
- Health endpoint, Bearer-token auth middleware, request IDs
- REST CRUD: agents, conversations, messages, runs, tasks, memory; settings read/write
- Structured JSON logs (pino), validation errors, graceful shutdown

## Phase 4 — Agent runtime
- `@bankai/agent`: OpenAI-compatible provider abstraction (Groq primary; OpenAI/LM Studio later)
- Run state machine with audit events; idempotent creation via `request_id`
- SSE streaming with batched token flush (backpressure); run endpoints
- Boot recovery: interrupted runs marked failed

## Phase 5 — Tools & memory
- `@bankai/tools` + registry with allowlist; task/time tools first
- Memory CRUD + SQLite FTS5 keyword retrieval (embeddings optional later behind retriever interface)
- Context assembly: agent prompt + relevant memory + conversation history

## Phase 6 — Tasks scheduler
- In-process cron on the `tasks` table
- Missed-run policy, crash recovery on boot, `last_run_at` tracking
- Executes prompts through the agent runtime, persists runs

## Phase 7 — Dashboard
- `apps/dashboard` (@bankai/dashboard): React + Vite + TypeScript, minimal deps, responsive CSS
- Streaming chat via SSE; agent manager; run history viewer
- Session login; mobile-responsive for remote access

## Phase 8 — Hardening & ship
- Backups/restore job + documented procedure
- Rate limiting, input hardening, secret handling via settings/env
- Test suite (vitest per package), lint gate, perf pass
- Packaging: single process serving UI; Tailscale remote-access guide

## Cross-cutting gates
- Every phase ships only when build + typecheck + lint + tests pass.
- Forward-only versioned migrations; no invested secret in code; tools run allowlisted only.