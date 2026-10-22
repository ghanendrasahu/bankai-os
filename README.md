# Bankai OS

Personal autonomous agent platform. A TypeScript monorepo with a Fastify server, React dashboard, and SQLite storage.

## Architecture

- **Single process** â€” server serves the dashboard's static build + one Node process
- **SQLite** via `@bankai/db` (better-sqlite3, WAL mode)
- **SSE streaming** for real-time agent communication
- **Monorepo** â€” `apps/*` for server and dashboard, `packages/*` for shared libraries

## Packages

| Package | Description |
|---------|-------------|
| `@bankai/db` | SQLite schema, migrations, typed repositories |
| `@bankai/contracts` | Shared Zod DTOs and types |
| `@bankai/config` | Zod-validated environment config |
| `@bankai/agent` | OpenAI-compatible provider abstraction (Groq primary) |
| `@bankai/tools` | Tool registry with allowlist |
| `@bankai/server` | Fastify REST API + SSE streaming |
| `@bankai/dashboard` | React + Vite + TypeScript dashboard |

## Getting Started

```bash
npm install
npm run build
npm run dev
```

This starts both the server and dashboard concurrently.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Build all packages |
| `npm run typecheck` | Type-check all packages |
| `npm run lint` | Lint all packages |
| `npm run dev` | Start server + dashboard in parallel |
| `npm start` | Start server in production mode |

## Default Model

`groq:llama-3.3-70b-versatile`

## License

MIT (c) 2026 ghanendrasahu - see [LICENSE](LICENSE).

Issues and pull requests are welcome.
