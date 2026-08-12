import { toolCallSchema } from "./run.js";
import { z } from "zod";

export const MESSAGE_ROLES = ["user", "assistant", "system", "tool"] as const;

export type MessageRole = (typeof MESSAGE_ROLES)[number];

export const messageInputSchema = z.object({
  conversationId: z.string().min(1),
  role: z.enum(MESSAGE_ROLES),
  content: z.string().default(""),
  toolCalls: z.array(toolCallSchema).nullable().default(null),
});

export type MessageInput = z.infer<typeof messageInputSchema>;

export const messageSchema = messageInputSchema.extend({
  id: z.string().min(1),
  createdAt: z.string().min(1),
});

export type Message = z.infer<typeof messageSchema>;