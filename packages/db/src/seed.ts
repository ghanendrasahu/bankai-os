import { DEFAULT_AGENT_TOOLS, DEFAULT_MODEL } from "@bankai/contracts";
import type { BankaiDb } from "./db.js";

export const DEFAULT_AGENT_NAME = "Bankai";

/**
 * A fresh database gets a ready-to-use personal assistant and its first
 * chat, so the dashboard works without any setup. Existing databases are
 * never touched.
 */
export function seedDefaults(db: BankaiDb): boolean {
  if (db.agents.list().length > 0) return false;

  const agent = db.agents.create({
    name: DEFAULT_AGENT_NAME,
    description: "Your personal assistant, created automatically on first boot.",
    systemPrompt:
      "You are Bankai, the user's personal AI assistant. Be direct, concise and helpful. " +
      "Use the tools available to you when they make an answer better: check the time, " +
      "and store or recall long-term memories when something is worth remembering.",
    model: DEFAULT_MODEL,
    tools: [...DEFAULT_AGENT_TOOLS],
    enabled: true,
  });

  db.conversations.create({ agentId: agent.id, title: "New chat" });
  return true;
}
