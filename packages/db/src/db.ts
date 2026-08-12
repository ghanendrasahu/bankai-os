import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import Database from "better-sqlite3";
import { migrations } from "./migrations/0001-initial.js";
import { runMigrations } from "./migrations/runner.js";
import {
  AgentsRepository,
  ConversationsRepository,
  MemoryRepository,
  MessagesRepository,
  RunsRepository,
  SettingsRepository,
  TasksRepository,
} from "./repositories.js";

export interface BankaiDbOptions {
  dbPath: string;
}

export class BankaiDb {
  readonly agents: AgentsRepository;
  readonly conversations: ConversationsRepository;
  readonly messages: MessagesRepository;
  readonly runs: RunsRepository;
  readonly tasks: TasksRepository;
  readonly memory: MemoryRepository;
  readonly settings: SettingsRepository;

  private readonly db: Database.Database;

  constructor(options: BankaiDbOptions) {
    mkdirSync(dirname(options.dbPath), { recursive: true });
    this.db = new Database(options.dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.db.pragma("busy_timeout = 5000");
    runMigrations(this.db, migrations);

    this.agents = new AgentsRepository(this.db);
    this.conversations = new ConversationsRepository(this.db);
    this.messages = new MessagesRepository(this.db);
    this.runs = new RunsRepository(this.db);
    this.tasks = new TasksRepository(this.db);
    this.memory = new MemoryRepository(this.db);
    this.settings = new SettingsRepository(this.db);
  }

  recoverInterruptedRuns(): number {
    return this.runs.markInterruptedInFlight();
  }

  raw(): Database.Database {
    return this.db;
  }

  close(): void {
    this.db.close();
  }
}

export function defaultDbPath(rootDir: string): string {
  return join(rootDir, "storage", "db", "bankai.db");
}