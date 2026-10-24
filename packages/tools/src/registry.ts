import { httpRequestTool } from "./tools/http.js";
import { runCommandTool } from "./tools/exec.js";
import { portScanTool } from "./tools/nmap.js";
import { reportWriteTool } from "./tools/report.js";
import { memoryListTool, memorySearchTool, memoryStoreTool } from "./tools/memory.js";
import { timeTool } from "./tools/time.js";
import { MapToolRegistry, type ToolRegistry } from "./types.js";

export const builtinTools = [
  timeTool,
  runCommandTool,
  portScanTool,
  httpRequestTool,
  reportWriteTool,
  memoryStoreTool,
  memorySearchTool,
  memoryListTool,
];

let defaultRegistry: ToolRegistry | undefined;

export function builtinRegistry(): ToolRegistry {
  if (!defaultRegistry) defaultRegistry = new MapToolRegistry(builtinTools);
  return defaultRegistry;
}

export type { Tool, ToolContext, ToolRegistry } from "./types.js";
export { MapToolRegistry } from "./types.js";