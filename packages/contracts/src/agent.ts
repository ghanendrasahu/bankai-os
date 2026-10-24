import { z } from "zod";

export const DEFAULT_MODEL = "groq:openai/gpt-oss-120b";

/** Default tool allowlist for the auto-seeded agent (names from @bankai/tools registry). */
export const DEFAULT_AGENT_TOOLS: string[] = [
  "time",
  "memory_store",
  "memory_search",
  "memory_list",
];

export const agentInputSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(1000).default(""),
  systemPrompt: z.string().max(100000).default(""),
  model: z.string().min(1).default(DEFAULT_MODEL),
  tools: z.array(z.string()).default([]),
  enabled: z.boolean().default(true),
});

export type AgentInput = z.infer<typeof agentInputSchema>;

export const agentSchema = agentInputSchema.extend({
  id: z.string().min(1),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export type Agent = z.infer<typeof agentSchema>;