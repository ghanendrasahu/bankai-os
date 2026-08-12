import type { MemoryKind } from "@bankai/contracts";
import type { Tool } from "../types.js";

const KINDS: MemoryKind[] = ["note", "fact", "goal", "reference"];

export const memoryStoreTool: Tool = {
  name: "memory_store",
  description:
    "Store a long-term memory note (fact, goal, reference, or note) for the current agent. Use for information worth remembering across conversations.",
  parameters: {
    type: "object",
    properties: {
      content: { type: "string", description: "The memory content to store" },
      kind: {
        type: "string",
        enum: KINDS,
        description: "Kind of memory",
      },
    },
    required: ["content"],
  },
  async execute(args, ctx) {
    const content = typeof args.content === "string" ? args.content : "";
    if (!content.trim()) return "error: content is required";
    const kind = KINDS.includes(args.kind as MemoryKind) ? (args.kind as MemoryKind) : "note";
    const memory = ctx.db.memory.create({ agentId: ctx.agentId, kind, content: content.trim() });
    return `stored memory ${memory.id}`;
  },
};

export const memorySearchTool: Tool = {
  name: "memory_search",
  description:
    "Search the current agent's long-term memory by keywords and return matching entries.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Keywords to search for" },
      limit: { type: "number", description: "Max results (default 5)" },
    },
    required: ["query"],
  },
  async execute(args, ctx) {
    const query = typeof args.query === "string" ? args.query : "";
    const limit = typeof args.limit === "number" ? Math.floor(args.limit) : 5;
    const results = ctx.db.memory.search(ctx.agentId, query, limit);
    if (results.length === 0) return "no matching memories";
    return results
      .map((m) => `[${m.kind}] ${m.content}`)
      .join("\n");
  },
};

export const memoryListTool: Tool = {
  name: "memory_list",
  description: "List the current agent's most recent memories.",
  parameters: {
    type: "object",
    properties: {
      limit: { type: "number", description: "Max results (default 20)" },
    },
    required: [],
  },
  async execute(args, ctx) {
    const limit = typeof args.limit === "number" ? Math.floor(args.limit) : 20;
    const results = ctx.db.memory.list(ctx.agentId, limit);
    if (results.length === 0) return "no memories stored";
    return results
      .map((m) => `[${m.kind}] ${m.content}`)
      .join("\n");
  },
};