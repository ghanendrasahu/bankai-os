import path from "node:path";
import { z } from "zod";

export const envSchema = z.object({
  HOST: z.string().min(1).default("0.0.0.0"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4173),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  BANKAI_TOKEN: z.string().min(8).optional(),
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

export function loadConfig(
  env: Record<string, string | undefined> = process.env
): BankaiConfig {
  const parsed = envSchema.parse(env);
  const storageRoot = parsed.STORAGE_ROOT ?? process.cwd();
  // Use the host platform's separator so defaults work on Windows and Linux.
  const dbPath = parsed.DB_PATH ?? path.join(storageRoot, "storage", "db", "bankai.db");
  return { ...parsed, storageRoot, dbPath };
}