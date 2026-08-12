import type { Database } from "better-sqlite3";

export interface Migration {
  version: number;
  name: string;
  up: (db: Database) => void;
}

const MIGRATIONS_TABLE = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version    INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  applied_at TEXT NOT NULL
);
`;

export function runMigrations(db: Database, migrations: Migration[]): void {
  db.exec(MIGRATIONS_TABLE);

  const applied = new Set<number>();
  for (const row of db.prepare("SELECT version FROM schema_migrations").all() as Array<{
    version: number;
  }>) {
    applied.add(row.version);
  }

  const sorted = [...migrations].sort((a, b) => a.version - b.version);
  const apply = db.transaction(() => {
    for (const migration of sorted) {
      if (applied.has(migration.version)) continue;
      migration.up(db);
      db.prepare(
        "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)"
      ).run(migration.version, migration.name, new Date().toISOString());
    }
  });
  apply();
}