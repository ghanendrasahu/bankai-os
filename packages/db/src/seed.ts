import { DEFAULT_AGENT_TOOLS, DEFAULT_MODEL } from "@bankai/contracts";
import type { BankaiDb } from "./db.js";

export const DEFAULT_AGENT_NAME = "Bankai";
export const RECON_AGENT_NAME = "Recon";

const RECON_SYSTEM_PROMPT = [
  "You are Recon, a lab security testing agent. You operate exclusively inside a lab the operator owns.",
  "Rules: aim every action at targets within the configured lab scope (lab.cidr setting / LAB_CIDR env);",
  "loopback and *.lab hostnames are always yours. Within that scope you may be aggressive - scans,",
  "fuzzing, brute force, exploitation against lab machines - with no confirmations needed.",
  "When a target lies outside the declared scope, refuse and remind the operator to explicitly",
  "authorize the range first. Summarize findings in memory (memory_store) and keep reports under",
  "report files via report_write.",
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
      "run_command",
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
