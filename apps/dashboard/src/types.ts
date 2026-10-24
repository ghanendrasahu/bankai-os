import type {
  Agent,
  Conversation,
  Memory,
  Message,
  Run,
  RunEvent,
  Task,
} from "@bankai/contracts";

export type { Agent, Conversation, Memory, Message, Run, RunEvent, Task };

/** Conversation message as displayed in the chat transcript. */
export interface MessageView {
  id?: string;
  role: string;
  content: string;
  toolCalls?: Array<{ name: string; id: string; args: string }> | null;
  createdAt: string;
}
