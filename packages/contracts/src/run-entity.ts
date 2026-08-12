import { runEventSchema, runStatusSchema } from "./run.js";
import { z } from "zod";

export const runInputSchema = z.object({
  agentId: z.string().min(1),
  conversationId: z.string().nullable().optional(),
  prompt: z.string().min(1).max(100000),
  requestId: z.string().nullable().optional(),
});

export type RunInput = z.infer<typeof runInputSchema>;

export const runSchema = z.object({
  id: z.string().min(1),
  agentId: z.string().min(1),
  conversationId: z.string().nullable(),
  requestId: z.string().nullable(),
  prompt: z.string(),
  status: runStatusSchema,
  events: z.array(runEventSchema),
  error: z.string().nullable(),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
});

export type Run = z.infer<typeof runSchema>;