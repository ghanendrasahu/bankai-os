import { assertTarget, tokenizeExtraArgs } from "../scope.js";
import type { Tool } from "../types.js";

export const portScanTool: Tool = {
  name: "port_scan",
  description:
    "Nmap scan of an explicitly chosen lab target (IP, CIDR or lab hostname). The " +
    "target is checked against the configured lab scope before anything runs. Pass " +
    "aggressive flags through extraArgs as needed - scans are allowed to be as messy " +
    "and thorough as the lab requires.",
  parameters: {
    type: "object",
    properties: {
      target: {
        type: "string",
        description: "IP, CIDR or lab hostname to scan (must be inside lab scope).",
      },
      ports: {
        type: ["string", "null"],
        description: 'Optional nmap -p expression, e.g. "1-65535" or "22,80,443". Omit this field entirely rather than passing null.',
      },
      extraArgs: {
        type: ["string", "null"],
        description: 'Additional nmap flags, e.g. "-sV -O --script vuln -T4". Omit this field entirely rather than passing null.',
      },
      timeoutMs: {
        type: ["number", "null"],
        description: "Timeout in milliseconds (default 600000, max 1800000). Omit this field entirely rather than passing null.",
      },
    },
    required: ["target"],
  },
  async execute(args, ctx) {
    const target = typeof args.target === "string" ? args.target.trim() : "";
    if (!target) return "error: target is required";

    const check = await assertTarget(ctx, target);
    if (!check.ok) return check.reason;

    const ports = typeof args.ports === "string" && args.ports.trim() ? ["-p", args.ports.trim()] : [];
    const extra = tokenizeExtraArgs(typeof args.extraArgs === "string" ? args.extraArgs : "");
    const timeoutMs = Math.min(
      Math.max(typeof args.timeoutMs === "number" ? args.timeoutMs : 600_000, 5_000),
      1_800_000
    );

    // Spawn directly so nmap's streaming stdout survives scans that outlive a
    // maxBuffer cap; capture whatever exists even when the timeout fires.
    const { spawn } = await import("node:child_process");
    const child = spawn("nmap", [...extra, ...ports, target], {
      cwd: process.cwd(),
      windowsHide: true,
    });

    const result = await new Promise<{ code: number | null; out: string }>((resolvePromise) => {
      let out = "";
      const cap = (chunk: Buffer) => {
        if (out.length < 400_000) out += chunk.toString();
      };
      child.stdout.on("data", cap);
      child.stderr.on("data", cap);
      const killer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
      child.on("error", (error: Error & { code?: string }) => {
        clearTimeout(killer);
        if (error.code === "ENOENT") {
          resolvePromise({ code: -1, out: "error: nmap is not installed (nmap.org/download) or not on PATH" });
        } else {
          resolvePromise({ code: -1, out: `error: nmap failed: ${error.message}` });
        }
      });
      child.on("close", (code) => {
        clearTimeout(killer);
        resolvePromise({ code: code ?? -1, out });
      });
    });

    if (result.code === -1 && result.out.startsWith("error:")) return result.out;
    const body = result.out.length > 40_000 ? `[... output truncated]\n${result.out.slice(-40_000)}` : result.out;
    return `nmap exit: ${result.code}\n${body}`.trim();
  },
};
