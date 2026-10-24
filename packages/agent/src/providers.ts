import OpenAI from "openai";

export interface ProviderInfo {
  baseURL: string;
  requiresKey: boolean;
}

export const PROVIDER_BASE_URLS: Record<string, ProviderInfo> = {
  opencode: { baseURL: "https://opencode.ai/inference/openai/v1", requiresKey: true },
  groq: { baseURL: "https://api.groq.com/openai/v1", requiresKey: true },
  openai: { baseURL: "https://api.openai.com/v1", requiresKey: true },
  lmstudio: { baseURL: "http://127.0.0.1:1234/v1", requiresKey: false },
};

const DEFAULT_PROVIDER_INFO: ProviderInfo = PROVIDER_BASE_URLS.groq as ProviderInfo;

export function createClient(provider: string, apiKey: string | undefined): OpenAI {
  const info = PROVIDER_BASE_URLS[provider] ?? DEFAULT_PROVIDER_INFO;
  return new OpenAI({
    apiKey: info.requiresKey ? (apiKey ?? "") : (apiKey ?? "lm-studio"),
    baseURL: info.baseURL,
    maxRetries: 2,
  });
}