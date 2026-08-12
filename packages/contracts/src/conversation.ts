import { z } from "zod";

export const conversationInputSchema = z.object({
  agentId: z.string().min(1),
  title: z.string().max(200).default("New chat"),
});

export type ConversationInput = z.infer<typeof conversationInputSchema>;

export const conversationSchema = conversationInputSchema.extend({
  id: z.string().min(1),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export type Conversation = z.infer<typeof conversationSchema>;