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

export interface MessageView {
  role: string;
  content: string;
  toolCalls?: Array<{ name: string; id: string; args: string }> | null;
  createdAt: string;
}

export function runTitle(run: Run): string {
  const prompt = run.prompt.trim();
  return prompt.length > 48 ? `${prompt.slice(0, 48)}...` : prompt || run.id;
}

export function runStatusLabel(status: string): string {
  return status;
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

export function formatRunEvents(events: RunEvent[]): string {
  return JSON.stringify(events, null, 2);
}