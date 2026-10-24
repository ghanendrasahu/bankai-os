import path from "node:path";
import { existsSync } from "node:fs";
import dotenv from "dotenv";
import { z } from "zod";

export const envSchema = z.object({
  HOST: z.string().min(1).default("0.0.0.0"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4173),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  BANKAI_TOKEN: z.string().min(8).optional(),
  OPENCODE_API_KEY: z.string().min(1).optional(),
  GROQ_API_KEY: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),
  STORAGE_ROOT: z.string().min(1).optional(),
  DB_PATH: z.string().min(1).optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

export interface BankaiConfig extends EnvConfig {
  storageRoot: string;
  dbPath: string;
}

/** Walk up from cwd to the filesystem root; first directory containing a .env wins. */
function findEnvFile(from: string): string | undefined {
  let dir = from;
  for (;;) {
    const candidate = path.join(dir, ".env");
    if (existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

export function loadConfig(
  env: Record<string, string | undefined> = process.env
): BankaiConfig {
  // .env is loaded from here or any parent directory; values already present
  // in the environment (process shell, Docker, CI) always win.
  const envFile = findEnvFile(process.cwd());
  const fileValues = envFile
    ? (dotenv.config({ path: envFile, override: false }).parsed ?? {})
    : {};
  // Empty-string entries (e.g. "KEY=" in .env files) mean "unset": the schema
  // minimums would otherwise reject them and crash the boot.
  const merged = Object.fromEntries(
    Object.entries({ ...fileValues, ...env }).filter(([, value]) => value !== "")
  );
  const parsed = envSchema.parse(merged);
  const storageRoot = parsed.STORAGE_ROOT ?? process.cwd();
  // Use the host platform's separator so defaults work on Windows and Linux.
  const dbPath = parsed.DB_PATH ?? path.join(storageRoot, "storage", "db", "bankai.db");
  return { ...parsed, storageRoot, dbPath };
}