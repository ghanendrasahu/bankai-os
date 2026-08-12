import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";

export function backupDatabase(dbPath: string, targetPath: string): void {
  mkdirSync(dirname(targetPath), { recursive: true });
  const source = new Database(dbPath, { readonly: true });
  try {
    source.exec(`VACUUM INTO '${targetPath.replaceAll("'", "''")}'`);
  } finally {
    source.close();
  }
}