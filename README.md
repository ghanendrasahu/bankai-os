# Bankai OS

A local-first agent operating system for a personal AI stack: a Fastify API
that serves agents, runs and streams their work, and persists everything in
SQLite — with a React dashboard on top.

The API is the product surface; the packages underneath it (agents, tasks,
tools, database, config) are independently usable.

## Architecture

```mermaid
flowchart LR
  UI[React dashboard] --> API[Fastify API]
  API --> AG[Agent runtime]
  API --> TK[Task scheduler]
  API --> DB[(SQLite - better-sqlite3)]
  AG --> TL[Tools + providers]
  TK --> DB
```

- **Agent runtime** — plans, streams and stores agent runs and their events.
- **Zero-config first run** — a fresh database is seeded with a default agent
  (`Bankai`, `groq:openai/gpt-oss-120b`, time + memory tools) and a starter
  chat, so the dashboard is usable immediately. Existing databases are untouched.
- **Task scheduler** — queues background work, survives restarts (runs that
  were in flight are marked `interrupted` on boot, not lost).
- **SQLite storage** — WAL mode, migrations applied on start, repositories
  for agents, conversations, messages, runs, tasks, memory and settings.
- **Migrations** — versioned and applied automatically, no `db:push`.

## Quick start

```bash
npm install
npm run build:packages     # workspace packages publish dist/ entry points
npm run dev:server         # Fastify API on :8080
npm run dev:dashboard      # Vite dashboard on :5173
```

Environment (`.env`, loaded automatically from the repo root — with `dotenv`,
walking up from the working directory; existing environment variables win):

| Variable | Purpose |
|---|---|
| `BANKAI_TOKEN` | Bearer token required on `/api/*` (open when unset) |
| `DB_PATH` | SQLite file location |
| `HOST` / `PORT` | Bind address |
| `GROQ_API_KEY` | Groq API key - the default provider (`groq:openai/gpt-oss-120b`); free key at console.groq.com |
| `OPENCODE_API_KEY` / `OPENAI_API_KEY` | Optional OpenCode (Zen) / OpenAI keys; use per-agent via `provider:model`. Note: OpenCode's `*-free` models only work inside the OpenCode client - API-key clients use its paid models |

## API

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/health` | Liveness (no auth) |
| `GET` | `/ready` | Readiness - pings the database, 503 when it is down |
| `GET` | `/api/agents` | List agents |
| `POST` | `/api/agents` | Create an agent |
| `GET` | `/api/conversations` | List conversations |
| `GET` | `/api/settings` | Read settings |
| `PUT` | `/api/settings` | Write settings |

Authentication is a bearer token compared against `BANKAI_TOKEN`; the hook
runs **before** routing, so even unknown `/api/*` paths answer 401 rather
than leaking which routes exist.

## Packages

| Package | What it owns |
|---|---|
| `@bankai/contracts` | Zod schemas shared by every package |
| `@bankai/config` | Typed, validated environment configuration |
| `@bankai/db` | SQLite client, migrations and repositories |
| `@bankai/tools` | Tool definitions and execution |
| `@bankai/agent` | The agent runtime |
| `@bankai/tasks` | Scheduler and worker loop |

## Testing

```bash
npm test          # vitest: API route integration, SQLite repositories, contract schemas
npm run lint
npm run typecheck
```

## Security lab mode

For pentesting your own lab machines, a seeded **Recon** agent ships with the
`run_command`, `port_scan`, `http_request` and `report_write` tools. Declare your
lab ranges once via `LAB_CIDR` (or the `lab.cidr` setting) and the structured
tools enforce that scope automatically - see [SECURITY.md](SECURITY.md).

The suites are offline and deterministic: the API tests drive the real
Fastify instance with `app.inject()`, and the repository tests run against a
real in-memory SQLite database.

## CI

`npm ci` → build workspace packages (in dependency order) → lint, typecheck
and test, plus a dashboard bundle build. Every push runs all of it.
