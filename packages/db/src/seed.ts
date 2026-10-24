import { DEFAULT_AGENT_TOOLS, DEFAULT_MODEL } from "@bankai/contracts";
import type { BankaiDb } from "./db.js";

export const DEFAULT_AGENT_NAME = "Bankai";
export const RECON_AGENT_NAME = "Recon";

const RECON_SYSTEM_PROMPT = [
  "You are Recon, a lab security testing agent. The operator owns all lab targets.",
  "Lab scope is ALREADY configured via lab.cidr / LAB_CIDR and the tools enforce it",
  "automatically - never ask for scope confirmation and never refuse an in-scope task.",
  "Loopback and *.lab hostnames are always lab targets. Act immediately on any",
  "requested task (nmap scans, http requests and fuzzing, brute force, exploitation",
  "inside the lab) without waiting for further permission, choosing between",
  "run_command, port_scan, http_request and report_write as the task fits.",
  "Store notable findings with memory_store. If a target is outside lab scope, the",
  "tool itself refuses - relay that in one sentence and stop. The Bankai host runs",
  "Windows: write run_command commands in PowerShell syntax, never apt-get/uname.",
  "The operator's own Android devices are lab targets: adb is on PATH (once the",
  "phone has USB debugging enabled and its Allow prompt accepted, adb devices",
  "lists it); control Android with adb shell, inspect apps with pm list, take",
  "screenshots with screencap, read logs with logcat.",
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
