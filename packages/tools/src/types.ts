import type { BankaiDb } from "@bankai/db";

export interface ToolContext {
  agentId: string;
  db: BankaiDb;
}

export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute(args: Record<string, unknown>, ctx: ToolContext): Promise<string>;
}

export interface ToolRegistry {
  get(name: string): Tool | undefined;
  list(): Tool[];
}

export class MapToolRegistry implements ToolRegistry {
  private readonly byName = new Map<string, Tool>();

  constructor(tools: Tool[]) {
    for (const tool of tools) this.byName.set(tool.name, tool);
  }

  get(name: string): Tool | undefined {
    return this.byName.get(name);
  }

  list(): Tool[] {
    return [...this.byName.values()];
  }
}