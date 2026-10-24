import { describe, expect, it } from "vitest";
import type OpenAI from "openai";

import { BankaiDb } from "@bankai/db";
import { AgentRuntime } from "../src/runtime.js";

type Delta = OpenAI.Chat.Completions.ChatCompletionChunk["choices"][number]["delta"];

const chunk = (delta: Delta): OpenAI.Chat.Completions.ChatCompletionChunk => {
  return { choices: [{ delta }] } as unknown as OpenAI.Chat.Completions.ChatCompletionChunk;
};

async function* streamOf(deltas: Delta[]): AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk> {
  for (const delta of deltas) yield chunk(delta);
}

interface CapturedRequest {
  messages: OpenAI.Chat.ChatCompletionMessageParam[];
  tools: OpenAI.Chat.ChatCompletionTool[] | undefined;
}

function stubClient(captures: CapturedRequest[], script: Delta[][]): OpenAI {
  const create = async (params: {
    messages: OpenAI.Chat.ChatCompletionMessageParam[];
    tools?: OpenAI.Chat.ChatCompletionTool[];
  }) => {
    captures.push({ messages: params.messages, tools: params.tools });
    const next = script.shift() ?? [{ content: "done" }];
    return streamOf(next);
  };
  return {
    chat: { completions: { create } },
  } as unknown as OpenAI;
}

describe("AgentRuntime", () => {
  it("sends the operator prompt as a user message for standalone runs", async () => {
    const db = new BankaiDb({ dbPath: ":memory:" });
    const agent = db.agents.create({
      name: "Standalone",
      description: "test",
      systemPrompt: "You act immediately.",
      model: "groq:openai/gpt-oss-120b",
      tools: ["time"],
      enabled: true,
    });

    const captures: CapturedRequest[] = [];
    const toolCallCall: Delta = {
      tool_calls: [
        {
          index: 0,
          id: "call_1",
          type: "function",
          function: { name: "time", arguments: "{}" },
        },
      ],
    } as unknown as Delta;

    const runtime = new AgentRuntime(db, {
      clientFactory: () => stubClient(captures, [[toolCallCall], [{ content: "all done" }]]),
    });

    const run = db.runs.create({
      id: "run_standalone",
      agentId: agent.id,
      conversationId: null,
      requestId: "req-standalone",
      prompt: "scan the lab and report",
      status: "queued",
    });

    const events = [];
    for await (const event of runtime.run(run.id)) events.push(event);

    expect(captures.length).toBe(2);
    // First request must include the run prompt as a user message even though
    // the run has no conversation - otherwise the model only sees the system
    // prompt and asks for instructions instead of acting.
    const sent = captures[0].messages;
    expect(sent.some((m) => m.role === "user" && m.content === "scan the lab and report")).toBe(true);

    const types = events.map((event) => event.type);
    expect(types).toContain("tool_call");
    expect(types).toContain("tool_result");
    expect(types).toContain("finished");
    expect(db.runs.byId(run.id)?.status).toBe("completed");

    // Second request carries the assistant tool call and the tool result.
    const second = captures[1].messages;
    expect(second.some((m) => m.role === "assistant" && "tool_calls" in m)).toBe(true);
    expect(second.some((m) => m.role === "tool")).toBe(true);
  });
});
