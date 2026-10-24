import { writeFileSync } from "node:fs";
import { join, parse } from "node:path";
import { labWorkspace } from "../scope.js";
import type { Tool } from "../types.js";

export const reportWriteTool: Tool = {
  name: "report_write",
  description:
    "Save a markdown report or findings file into this agent's lab workspace and return " +
    "its absolute path. Use for engagement notes, recon summaries and finding write-ups.",
  parameters: {
    type: "object",
    properties: {
      filename: {
        type: "string",
        description: "File name only (no paths), e.g. 'recon-192-168-1-50.md'. .md is appended when missing.",
      },
      content: { type: "string", description: "Report body (markdown)." },
    },
    required: ["filename", "content"],
  },
  async execute(args, ctx) {
    const raw = typeof args.filename === "string" ? args.filename.trim() : "";
    if (!raw) return "error: filename is required";
    const content = typeof args.content === "string" ? args.content : "";
    if (!content.trim()) return "error: content is required";

    const base = parse(raw).base || "report.md";
    const filename = base.endsWith(".md") ? base : `${base}.md`;

    try {
      const target = join(labWorkspace(ctx.agentId), filename);
      writeFileSync(target, content, "utf8");
      return `saved ${target} (${Buffer.byteLength(content)} bytes)`;
    } catch (error) {
      return `error: could not write report: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
};
