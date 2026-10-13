import { DEFAULT_AGENT_TOOLS, DEFAULT_MODEL } from "@bankai/contracts";
import type { BankaiDb } from "./db.js";

export const DEFAULT_AGENT_NAME = "Bankai";
export const RECON_AGENT_NAME = "Recon";

const RECON_SYSTEM_PROMPT = [
  "You are Recon, a lab security testing agent. The operator owns all lab targets.",
  "Lab scope is configured via lab.cidr / LAB_CIDR and the scope-aware tools enforce it.",
  "Work inside that scope, prefer the dedicated port_scan and http_request tools,",
  "and report findings with report_write. If a target is outside lab scope, the tool",
  "refuses it - relay that in one sentence and stop. Shell execution is not granted",
  "by default; an operator can attach run_command explicitly after reviewing the risk.",
  "The Bankai host runs Windows: write PowerShell syntax, never apt-get/uname.",
  "The operator's own Android devices are lab targets when adb is configured.",
].join(" ");

/**
 * Ensure the lab agent exists so security workflows are ready out of the box.
 * Never touches an existing agent named Recon.
 */
export function seedSecurityAgent(db: BankaiDb): boolean {
  if (db.agents.list().some((agent) => agent.name === RECON_AGENT_NAME)) return false;

  db.agents.create({
    name: RECON_AGENT_NAME,
    description: "Lab security testing agent (own the targets you point it at).",
    systemPrompt: RECON_SYSTEM_PROMPT,
    model: DEFAULT_MODEL,
    tools: [
      "port_scan",
      "http_request",
      "report_write",
      "memory_store",
      "memory_search",
      "memory_list",
      "time",
    ],
    enabled: true,
  });
  return true;
}

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
