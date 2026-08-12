import { z } from "zod";

export const RUN_STATUSES = [
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
  "interrupted",
] as const;

export type RunStatus = (typeof RUN_STATUSES)[number];

export const runStatusSchema = z.enum(RUN_STATUSES);

export const runEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("queued"), at: z.string().min(1) }),
  z.object({ type: z.literal("started"), at: z.string().min(1) }),
  z.object({
    type: z.literal("tool_call"),
    at: z.string().min(1),
    id: z.string().min(1),
    name: z.string().min(1),
    args: z.string(),
  }),
  z.object({
    type: z.literal("tool_result"),
    at: z.string().min(1),
    id: z.string().min(1),
    name: z.string().min(1),
    output: z.string(),
  }),
  z.object({ type: z.literal("delta"), at: z.string().min(1), text: z.string() }),
  z.object({ type: z.literal("finished"), at: z.string().min(1) }),
  z.object({ type: z.literal("failed"), at: z.string().min(1), error: z.string() }),
  z.object({ type: z.literal("cancelled"), at: z.string().min(1) }),
  z.object({ type: z.literal("interrupted"), at: z.string().min(1) }),
]);

export type RunEvent = z.infer<typeof runEventSchema>;

export const toolCallSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  args: z.string(),
});

export type ToolCall = z.infer<typeof toolCallSchema>;