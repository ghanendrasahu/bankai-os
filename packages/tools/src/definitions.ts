import type OpenAI from "openai";
import type { Tool } from "./types.js";

export function toApiTool(tool: Tool): OpenAI.Chat.ChatCompletionTool {
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters as Record<string, unknown>,
    },
  };
}

export function apiToolsFor(
  allowedNames: string[],
  registry: { get(name: string): Tool | undefined }
): OpenAI.Chat.ChatCompletionTool[] | undefined {
  const tools: OpenAI.Chat.ChatCompletionTool[] = [];
  for (const name of allowedNames) {
    const tool = registry.get(name);
    if (tool) tools.push(toApiTool(tool));
  }
  return tools.length ? tools : undefined;
}