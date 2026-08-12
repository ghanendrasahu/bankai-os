import type { BankaiDb } from "@bankai/db";

export function resolveProviderKeys(
  db: BankaiDb,
  env: Record<string, string | undefined> = process.env
): Record<string, string | undefined> {
  const settings = db.settings.all();
  return {
    groq: env.GROQ_API_KEY ?? settings["groq.api_key"],
    openai: env.OPENAI_API_KEY ?? settings["openai.api_key"],
    lmstudio: env.LMSTUDIO_API_KEY ?? settings["lmstudio.api_key"],
  };
}