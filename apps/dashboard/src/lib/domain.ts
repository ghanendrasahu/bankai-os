/**
 * Static domain knowledge about the Bankai OS backend, mirrored for display
 * purposes: providers, the built-in tool catalog and run/task status metadata.
 * Nothing here invents capabilities — it only documents what the server offers.
 */

/** Known providers (see @bankai/agent keys resolution + model parsing). */
export interface ProviderInfo {
  id: string;
  label: string;
  keySetting: string | null;
  hint: string;
}

export const PROVIDERS: ProviderInfo[] = [
  {
    id: "groq",
    label: "Groq",
    keySetting: "groq.api_key",
    hint: "Free-tier friendly cloud inference (default provider). Key at console.groq.com.",
  },
  {
    id: "openai",
    label: "OpenAI",
    keySetting: "openai.api_key",
    hint: "OpenAI cloud models.",
  },
  {
    id: "opencode",
    label: "OpenCode",
    keySetting: "opencode.api_key",
    hint: "OpenCode (Zen) models; *-free models only work in the OpenCode client.",
  },
  {
    id: "lmstudio",
    label: "LM Studio",
    keySetting: "lmstudio.api_key",
    hint: "Local inference server — no API key required.",
  },
];

export function providerInfo(provider: string): ProviderInfo | undefined {
  return PROVIDERS.find((p) => p.id === provider);
}

/** Parse "provider:model" the same way the runtime does (packages/agent/src/models.ts). */
export function parseModelRef(ref: string): { provider: string; model: string } {
  const idx = ref.indexOf(":");
  if (idx === -1) return { provider: "groq", model: ref };
  return { provider: ref.slice(0, idx) || "groq", model: ref.slice(idx + 1) || ref };
}

/** Built-in tool catalog, mirroring @bankai/tools registry entries. */
export interface ToolInfo {
  name: string;
  description: string;
  group: "assistant" | "lab";
}

export const TOOL_CATALOG: ToolInfo[] = [
  {
    name: "time",
    description: "Current date/time, optionally for an IANA timezone.",
    group: "assistant",
  },
  {
    name: "memory_store",
    description: "Save a long-term memory (note, fact, goal or reference) for the agent.",
    group: "assistant",
  },
  {
    name: "memory_search",
    description: "Keyword-search the agent's long-term memory.",
    group: "assistant",
  },
  {
    name: "memory_list",
    description: "List the agent's most recent memories.",
    group: "assistant",
  },
  {
    name: "run_command",
    description: "Run arbitrary commands on the host (PowerShell host). Lab workhorse — not automatically scope-enforced.",
    group: "lab",
  },
  {
    name: "port_scan",
    description: "Nmap scan of an explicit lab target, checked against the configured lab scope.",
    group: "lab",
  },
  {
    name: "http_request",
    description: "Raw HTTP requests against lab targets (fuzzing, auth attempts — scope-enforced).",
    group: "lab",
  },
  {
    name: "report_write",
    description: "Write markdown reports and findings into the agent's lab workspace.",
    group: "lab",
  },
];

export function toolInfo(name: string): ToolInfo | undefined {
  return TOOL_CATALOG.find((t) => t.name === name);
}

/** Run status presentation (the six states from @bankai/contracts). */
import type { RunStatus } from "@bankai/contracts";

export interface StatusMeta {
  label: string;
  tone: "ok" | "warn" | "danger" | "info" | "accent" | "neutral";
}

export const RUN_STATUS_META: Record<RunStatus, StatusMeta> = {
  queued: { label: "Queued", tone: "warn" },
  running: { label: "Running", tone: "accent" },
  completed: { label: "Completed", tone: "ok" },
  failed: { label: "Failed", tone: "danger" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  interrupted: { label: "Interrupted", tone: "danger" },
};

export const RUN_STATUSES: RunStatus[] = ["queued", "running", "completed", "failed", "cancelled", "interrupted"];

/** Cron examples surfaced next to the task editor input. */
export const CRON_EXAMPLES: Array<{ expression: string; description: string }> = [
  { expression: "*/5 * * * *", description: "Every 5 minutes" },
  { expression: "0 * * * *", description: "Hourly" },
  { expression: "0 9 * * *", description: "Daily at 09:00" },
  { expression: "0 9 * * mon", description: "Mondays at 09:00" },
  { expression: "0 9 1 * *", description: "1st of the month 09:00" },
];
