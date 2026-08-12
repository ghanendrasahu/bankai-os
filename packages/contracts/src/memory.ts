import { z } from "zod";

export const MEMORY_KINDS = ["note", "fact", "goal", "reference"] as const;

export type MemoryKind = (typeof MEMORY_KINDS)[number];

export const memoryInputSchema = z.object({
  agentId: z.string().min(1),
  kind: z.enum(MEMORY_KINDS).default("note"),
  content: z.string().min(1).max(10000),
});

export type MemoryInput = z.infer<typeof memoryInputSchema>;

export const memorySchema = memoryInputSchema.extend({
  id: z.string().min(1),
  createdAt: z.string().min(1),
});

export type Memory = z.infer<typeof memorySchema>;