import { newId, runInputSchema } from "@bankai/contracts";
import type { FastifyInstance } from "fastify";
import { badRequest, notFound } from "../errors.js";
import { validate } from "../validate.js";

type IdParams = { Params: { id: string } };

export function registerRunsRoutes(app: FastifyInstance): void {
  app.get("/runs", async (request) => {
    const query = request.query as { agentId?: string; limit?: string };
    const limit = Number(query.limit ?? 50);
    return app.db.runs.list(query.agentId, Number.isFinite(limit) ? limit : 50);
  });

  app.get<IdParams>("/runs/:id", async (request, reply) => {
    const run = app.db.runs.byId(request.params.id);
    if (!run) {
      notFound(reply, `run ${request.params.id} not found`);
      return;
    }
    return run;
  });

  app.post("/runs", async (request, reply) => {
    const input = validate(runInputSchema, request.body, reply);
    if (!input) return;

    if (input.requestId) {
      const existing = app.db.runs.byRequestId(input.requestId);
      if (existing) return existing;
    }

    const agent = app.db.agents.byId(input.agentId);
    if (!agent) {
      notFound(reply, `agent ${input.agentId} not found`);
      return;
    }
    if (!agent.enabled) {
      badRequest(reply, `agent ${input.agentId} is disabled`);
      return;
    }

    if (input.conversationId && !app.db.conversations.byId(input.conversationId)) {
      notFound(reply, `conversation ${input.conversationId} not found`);
      return;
    }

    const run = app.db.runs.create({
      id: newId("run"),
      agentId: input.agentId,
      conversationId: input.conversationId ?? null,
      requestId: input.requestId ?? null,
      prompt: input.prompt,
    });

    if (input.conversationId) app.db.conversations.touch(input.conversationId);

    reply.code(201);
    return run;
  });

  app.post<IdParams>("/runs/:id/cancel", async (request, reply) => {
    const run = app.db.runs.byId(request.params.id);
    if (!run) {
      notFound(reply, `run ${request.params.id} not found`);
      return;
    }
    if (run.status !== "queued" && run.status !== "running") {
      badRequest(reply, `run cannot be cancelled from status ${run.status}`);
      return;
    }
    app.runAborts.get(run.id)?.abort();
    return app.db.runs.appendEvent(run.id, {
      type: "cancelled",
      at: new Date().toISOString(),
    });
  });
}