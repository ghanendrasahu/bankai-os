import { z } from "zod";

export const DEFAULT_MODEL = "opencode:glm-5.3-flash";

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