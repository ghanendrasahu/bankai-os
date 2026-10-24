import type { RunEvent, ToolCall, Memory } from "@bankai/contracts";
import type { Message } from "@bankai/contracts";
import type { BankaiDb } from "@bankai/db";
import {
  apiToolsFor,
  builtinRegistry,
  type ToolContext,
  type ToolRegistry,
} from "@bankai/tools";
import OpenAI from "openai";
import { resolveProviderKeys } from "./keys.js";
import { parseModel } from "./models.js";
import { createClient } from "./providers.js";

const now = (): string => new Date().toISOString();
const MAX_TOOL_ITERATIONS = 8;

type ChatMessageParam = OpenAI.Chat.ChatCompletionMessageParam;

function toToolCallsParam(toolCalls: ToolCall[]): OpenAI.Chat.ChatCompletionMessageToolCall[] {
  return toolCalls.map((call) => ({
    id: call.id,
    type: "function",
    function: { name: call.name, arguments: call.args },
  }));
}

function mapToolCallChunks(
  chunks: OpenAI.Chat.ChatCompletionChunk["choices"][number]["delta"]["tool_calls"]
): ToolCall[] {
  const acc: Array<{ id: string; name: string; args: string }> = [];
  for (const chunk of chunks ?? []) {
    const index = chunk.index;
    const existing = acc[index];
    if (!existing) {
      acc[index] = {
        id: chunk.id ?? `call_${index}`,
        name: chunk.function?.name ?? "",
        args: chunk.function?.arguments ?? "",
      };
    } else {
      if (chunk.id) existing.id = chunk.id;
      if (chunk.function?.name) existing.name += chunk.function.name;
      if (chunk.function?.arguments) existing.args += chunk.function.arguments;
    }
  }
  return acc
    .filter((call) => call.id && call.name)
    .map((call) => ({ ...call, args: call.args || "{}" }));
}

function buildChatMessages(
  agent: { systemPrompt: string },
  history: Message[]
): ChatMessageParam[] {
  const messages: ChatMessageParam[] = [];
  if (agent.systemPrompt) {
    messages.push({ role: "system", content: agent.systemPrompt });
  }
  for (const message of history) {
    if (message.role === "user") {
      messages.push({ role: "user", content: message.content });
    } else if (message.role === "assistant") {
      if (message.toolCalls?.length) {
        messages.push({
          role: "assistant",
          content: message.content || null,
          tool_calls: toToolCallsParam(message.toolCalls),
        });
      } else {
        messages.push({ role: "assistant", content: message.content });
      }
    } else if (message.role === "tool") {
      messages.push({
        role: "tool",
        content: message.content,
        tool_call_id: message.toolCalls?.[0]?.id ?? "",
      });
    }
  }
  return messages;
}

function buildSystemPrompt(base: string, memories: Memory[]): string {
  if (memories.length === 0) return base;
  const section = [
    "## Relevant memories",
    ...memories.map((m) => `- [${m.kind}] ${m.content}`),
  ].join("\n");
  return base ? `${base}\n\n${section}` : section;
}

function isAbort(signal: AbortSignal | undefined, error: unknown): boolean {
  return signal?.aborted === true || (error instanceof Error && error.name === "AbortError");
}

export interface AgentRuntimeOptions {
  registry?: ToolRegistry;
  clientFactory?: (provider: string, apiKey: string | undefined) => OpenAI;
}

export class AgentRuntime {
  private readonly registry: ToolRegistry;
  private readonly clientFactory: (provider: string, apiKey: string | undefined) => OpenAI;
  private readonly usesDefaultClient: boolean;

  constructor(
    private readonly db: BankaiDb,
    options: AgentRuntimeOptions = {}
  ) {
    this.registry = options.registry ?? builtinRegistry();
    this.clientFactory = options.clientFactory ?? createClient;
    this.usesDefaultClient = options.clientFactory === undefined;
  }

  private toolContext(agentId: string): ToolContext {
    return { agentId, db: this.db };
  }

  async *run(runId: string, signal?: AbortSignal): AsyncGenerator<RunEvent> {
    const run = this.db.runs.byId(runId);
    if (!run) throw new Error(`run ${runId} not found`);
    if (run.status !== "queued") throw new Error(`run already started (${run.status})`);

    const agent = this.db.agents.byId(run.agentId);
    if (!agent) {
      const event: RunEvent = { type: "failed", at: now(), error: `agent ${run.agentId} not found` };
      this.db.runs.appendEvent(runId, event);
      this.db.runs.setStatus(runId, "failed", event.error);
      yield event;
      return;
    }

    this.db.runs.setStatus(runId, "running");
    const started: RunEvent = { type: "started", at: now() };
    this.db.runs.appendEvent(runId, started);
    yield started;

    try {
      if (run.conversationId) {
        this.db.messages.create({
          conversationId: run.conversationId,
          role: "user",
          content: run.prompt,
          toolCalls: null,
        });
        this.db.conversations.touch(run.conversationId);
      }

      const { provider, model } = parseModel(agent.model);
      const keys = resolveProviderKeys(this.db);
      const apiKey = keys[provider];
      if (!apiKey && provider !== "lmstudio" && this.usesDefaultClient) {
        throw new Error(`no API key configured for provider "${provider}"`);
      }
      const client = this.clientFactory(provider, apiKey);

      const history = run.conversationId
        ? this.db.messages.listByConversation(run.conversationId)
        : [];
      const relevantMemories = this.db.memory.search(agent.id, run.prompt, 5);
      const systemPrompt = buildSystemPrompt(agent.systemPrompt, relevantMemories);
      const messages = buildChatMessages({ systemPrompt }, history);
      // Standalone runs (no conversation) must still carry the operator's
      // prompt to the model - otherwise the model sees only the system prompt
      // and politely asks what to do instead of acting.
      if (!run.conversationId) {
        messages.push({ role: "user", content: run.prompt });
      }
      const apiTools = apiToolsFor(agent.tools, this.registry);

      for await (const event of this.executeConversation({
        runId,
        agentId: agent.id,
        conversationId: run.conversationId,
        allowedTools: agent.tools,
        model,
        client,
        messages,
        apiTools,
        signal,
      })) {
        yield event;
      }

      if (signal?.aborted) {
        const cancelled: RunEvent = { type: "cancelled", at: now() };
        this.db.runs.appendEvent(runId, cancelled);
        this.db.runs.setStatus(runId, "cancelled");
        yield cancelled;
        return;
      }

      const finished: RunEvent = { type: "finished", at: now() };
      this.db.runs.appendEvent(runId, finished);
      this.db.runs.setStatus(runId, "completed");
      yield finished;
    } catch (error) {
      if (isAbort(signal, error)) {
        const cancelled: RunEvent = { type: "cancelled", at: now() };
        this.db.runs.appendEvent(runId, cancelled);
        this.db.runs.setStatus(runId, "cancelled");
        yield cancelled;
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      const failed: RunEvent = { type: "failed", at: now(), error: message };
      this.db.runs.appendEvent(runId, failed);
      this.db.runs.setStatus(runId, "failed", message);
      yield failed;
    }
  }

  private async *executeConversation(params: {
    runId: string;
    agentId: string;
    conversationId: string | null;
    allowedTools: string[];
    model: string;
    client: OpenAI;
    messages: ChatMessageParam[];
    apiTools: OpenAI.Chat.ChatCompletionTool[] | undefined;
    signal?: AbortSignal;
  }): AsyncGenerator<RunEvent> {
    const { runId, agentId, conversationId, allowedTools, model, client, apiTools, signal } = params;
    let messages = params.messages;

    for (let iteration = 0; iteration <= MAX_TOOL_ITERATIONS; iteration++) {
      const stream = await client.chat.completions.create(
        { model, messages, stream: true, tools: apiTools },
        { signal }
      );

      let fullText = "";
      let toolCallChunks: OpenAI.Chat.ChatCompletionChunk["choices"][number]["delta"]["tool_calls"] = [];

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        if (delta?.content) {
          fullText += delta.content;
          this.db.runs.appendTextDelta(runId, delta.content);
          yield { type: "delta", at: now(), text: delta.content };
        }
        if (delta?.tool_calls) {
          toolCallChunks = [...toolCallChunks, ...delta.tool_calls];
        }
        if (signal?.aborted) break;
      }

      if (signal?.aborted) return;
      const toolCalls = mapToolCallChunks(toolCallChunks);

      const assistantMessage: ChatMessageParam = toolCalls.length
        ? {
            role: "assistant",
            content: fullText || null,
            tool_calls: toolCalls.map((call) => ({
              id: call.id,
              type: "function",
              function: { name: call.name, arguments: call.args },
            })),
          }
        : { role: "assistant", content: fullText };

      if (conversationId) {
        this.db.messages.create({
          conversationId,
          role: "assistant",
          content: fullText,
          toolCalls: toolCalls.length ? toolCalls : null,
        });
      }

      if (toolCalls.length === 0) {
        messages = [...messages, assistantMessage];
        return;
      }

      const toolResults: ChatMessageParam[] = [];
      for (const call of toolCalls) {
        this.db.runs.appendEvent(runId, {
          type: "tool_call",
          at: now(),
          id: call.id,
          name: call.name,
          args: call.args,
        });
        yield { type: "tool_call", at: now(), id: call.id, name: call.name, args: call.args };

        const tool = this.registry.get(call.name);
        const allowed = allowedTools.includes(call.name);
        let output: string;
        if (!allowed || !tool) {
          output = `error: tool "${call.name}" is not enabled for this agent`;
        } else {
          try {
            const args = parseJsonArgs(call.args);
            output = await tool.execute(args, this.toolContext(agentId));
          } catch (error) {
            output = `error: ${error instanceof Error ? error.message : String(error)}`;
          }
        }

        if (conversationId) {
          this.db.messages.create({
            conversationId,
            role: "tool",
            content: output,
            toolCalls: [{ id: call.id, name: call.name, args: call.args }],
          });
        }

        this.db.runs.appendEvent(runId, {
          type: "tool_result",
          at: now(),
          id: call.id,
          name: call.name,
          output,
        });
        yield { type: "tool_result", at: now(), id: call.id, name: call.name, output };

        toolResults.push({ role: "tool", tool_call_id: call.id, content: output });
      }

      messages = [...messages, assistantMessage, ...toolResults];
    }

    throw new Error(`tool loop exceeded ${MAX_TOOL_ITERATIONS} iterations`);
  }
}

function parseJsonArgs(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}