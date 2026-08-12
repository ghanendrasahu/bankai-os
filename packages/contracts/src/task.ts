import { z } from "zod";

export const taskInputSchema = z.object({
  agentId: z.string().min(1),
  name: z.string().min(1).max(200),
  cron: z.string().min(1).max(200),
  prompt: z.string().min(1).max(100000),
  enabled: z.boolean().default(true),
});

export type TaskInput = z.infer<typeof taskInputSchema>;

export const taskSchema = taskInputSchema.extend({
  id: z.string().min(1),
  lastRunAt: z.string().nullable(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export type Task = z.infer<typeof taskSchema>;