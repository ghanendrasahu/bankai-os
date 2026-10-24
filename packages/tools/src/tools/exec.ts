import { exec as execRaw } from "node:child_process";
import { existsSync } from "node:fs";
import { promisify } from "node:util";
import { isAbsolute, resolve } from "node:path";
import { labWorkspace } from "../scope.js";
import type { Tool } from "../types.js";

const exec = promisify(execRaw) as (
  command: string,
  options: { timeout: number; cwd: string; maxBuffer: number; windowsHide: boolean }
) => Promise<{ stdout: string; stderr: string }>;

const MAX_OUTPUT_CHARS = 16_000;
const DEFAULT_TIMEOUT_MS = 300_000;
const MAX_TIMEOUT_MS = 1_800_000;

function clampTimeout(value: unknown): number {
  const ms = typeof value === "number" ? Math.floor(value) : DEFAULT_TIMEOUT_MS;
  return Math.min(Math.max(ms, 1_000), MAX_TIMEOUT_MS);
}

/** Keep the tail: the end of a command's output is usually the verdict. */
function capTail(text: string): string {
  if (text.length <= MAX_OUTPUT_CHARS) return text;
  const dropped = text.length - MAX_OUTPUT_CHARS;
  const suffix = text.slice(-MAX_OUTPUT_CHARS);
  return `[... ${dropped} earlier chars truncated]\n${suffix}`;
}

export const runCommandTool: Tool = {
  name: "run_command",
  description:
    "Run an arbitrary command on the host running Bankai OS (full user privileges, " +
    "no permission prompts) and return stdout/stderr plus the exit code. Intended for " +
    "lab security work: nmap, ffuf, curl, dig, etc. Aim commands only at lab targets " +
    "you are authorized to test; use structured tools (port_scan, http_request) when " +
    "you want enforced target scoping.",
  parameters: {
    type: "object",
    properties: {
      command: { type: "string", description: "The command line to execute." },
      timeoutMs: {
        type: "number",
        description: `Timeout in milliseconds (default ${DEFAULT_TIMEOUT_MS}, max ${MAX_TIMEOUT_MS}). Long scans are safe to let run.`,
      },
      cwd: {
        type: "string",
        description: "Working directory; relative paths resolve inside this agent's lab workspace.",
      },
    },
    required: ["command"],
  },
  async execute(args, ctx) {
    const command = typeof args.command === "string" ? args.command.trim() : "";
    if (!command) return "error: command is required";

    let cwd: string;
    const requested = typeof args.cwd === "string" ? args.cwd : "";
    if (!requested) {
      cwd = labWorkspace(ctx.agentId);
    } else if (isAbsolute(requested)) {
      cwd = requested;
    } else {
      cwd = resolve(labWorkspace(ctx.agentId), requested);
    }
    if (!existsSync(cwd)) return `error: cwd does not exist: ${cwd}`;

    try {
      const { stdout, stderr } = await exec(command, {
        timeout: clampTimeout(args.timeoutMs),
        cwd,
        maxBuffer: 64 * 1024 * 1024,
        windowsHide: true,
      });
      const output = capTail(`${stdout}\n${stderr}`.trim());
      return `exit: 0\n${output}`;
    } catch (error) {
      const err = error as Error & { code?: string | number; stdout?: string; stderr?: string; killed?: boolean };
      if (err.code === "ENOENT") {
        return "error: executable not found on PATH (install the tool, e.g. nmap, or adjust the command)";
      }
      const partial = capTail(`${err.stdout ?? ""}\n${err.stderr ?? ""}`.trim());
      const head = err.killed ? "exit: timeout" : `exit: ${err.code ?? 1}`;
      return `error: command failed\n${head}\n${partial}`;
    }
  },
};
