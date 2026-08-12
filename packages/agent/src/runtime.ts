import type { RunEvent, ToolCall } from "@bankai/contracts";
import type { Message } from "@bankai/contracts";
import type { BankaiDb } from "@bankai/db";
import OpenAI from "openai";
import { resolveProviderKeys } from "./keys.js";
import { parseModel } from "./models.js";
import { createClient } from "./providers.js";

const now = (): string => new Date().toISOString();

type ChatMessageParam = OpenAI.Chat.ChatCompletionMessageParam;

function toToolCallsParam(toolCalls: ToolCall[]): OpenAI.Chat.ChatCompletionMessageToolCall[] {
  return toolCalls.map((call) => ({
    id: call.id,
    type: "function",
    function: { name: call.name, arguments: call.args },
  }));
}

function mapToolCallChunks(chunks: OpenAI.Chat.ChatCompletionChunk["choices"][number]["delta"]["tool_calls"]): ToolCall[] {
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
  return acc.filter((call) => call.id && call.name).map((call) => ({ ...call, args: call.args || "{}" }));
}

function buildChatMessages(agent: { systemPrompt: string }, history: Message[]): ChatMessageParam[] {
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

function isAbort(signal: AbortSignal | undefined, error: unknown): boolean {
  return signal?.aborted === true || (error instanceof Error && error.name === "AbortError");
}

export class AgentRuntime {
  constructor(private readonly db: BankaiDb) {}

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
      if (!apiKey && provider !== "lmstudio") {
        throw new Error(`no API key configured for provider "${provider}"`);
      }
      const client = createClient(provider, apiKey);

      const history = run.conversationId
        ? this.db.messages.listByConversation(run.conversationId)
        : [];
      const messages = buildChatMessages(agent, history);

      const stream = await client.chat.completions.create(
        {
          model,
          messages,
          stream: true,
        },
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

      const toolCalls = mapToolCallChunks(toolCallChunks);

      if (run.conversationId) {
        this.db.messages.create({
          conversationId: run.conversationId,
          role: "assistant",
          content: fullText,
          toolCalls: toolCalls.length ? toolCalls : null,
        });
        this.db.conversations.touch(run.conversationId);
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
}