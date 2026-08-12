import { initialMigration } from "./0001-initial.js";
import { memoryFtsMigration } from "./0002-memory-fts.js";
import type { Migration } from "./runner.js";

export const migrations: Migration[] = [initialMigration, memoryFtsMigration];

export type { Migration } from "./runner.js";
export { runMigrations } from "./runner.js";