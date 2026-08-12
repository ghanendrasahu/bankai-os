import {
  agentInputSchema,
  conversationInputSchema,
  memoryInputSchema,
  taskInputSchema,
} from "@bankai/contracts";
import type { FastifyInstance } from "fastify";
import { notFound } from "../errors.js";
import { validate } from "../validate.js";

type IdParams = { Params: { id: string } };

export function registerAgentsRoutes(app: FastifyInstance): void {
  app.get("/agents", async () => app.db.agents.list());

  app.get<IdParams>("/agents/:id", async (request, reply) => {
    const agent = app.db.agents.byId(request.params.id);
    if (!agent) {
      notFound(reply, `agent ${request.params.id} not found`);
      return;
    }
    return agent;
  });

  app.post("/agents", async (request, reply) => {
    const input = validate(agentInputSchema, request.body, reply);
    if (!input) return;
    const agent = app.db.agents.create(input);
    reply.code(201);
    return agent;
  });

  app.patch<IdParams>("/agents/:id", async (request, reply) => {
    const patch = validate(agentInputSchema.partial(), request.body, reply);
    if (!patch) return;
    const agent = app.db.agents.update(request.params.id, patch);
    if (!agent) {
      notFound(reply, `agent ${request.params.id} not found`);
      return;
    }
    return agent;
  });

  app.delete<IdParams>("/agents/:id", async (request, reply) => {
    if (!app.db.agents.remove(request.params.id)) {
      notFound(reply, `agent ${request.params.id} not found`);
      return;
    }
    reply.code(204);
    return;
  });
}

export function registerConversationsRoutes(app: FastifyInstance): void {
  app.get("/conversations", async (request) => {
    const agentId = (request.query as { agentId?: string }).agentId;
    return app.db.conversations.list(agentId);
  });

  app.get<IdParams>("/conversations/:id", async (request, reply) => {
    const conversation = app.db.conversations.byId(request.params.id);
    if (!conversation) {
      notFound(reply, `conversation ${request.params.id} not found`);
      return;
    }
    return conversation;
  });

  app.post("/conversations", async (request, reply) => {
    const input = validate(conversationInputSchema, request.body, reply);
    if (!input) return;
    if (!app.db.agents.byId(input.agentId)) {
      notFound(reply, `agent ${input.agentId} not found`);
      return;
    }
    const conversation = app.db.conversations.create(input);
    reply.code(201);
    return conversation;
  });

  app.patch<IdParams>("/conversations/:id", async (request, reply) => {
    const patch = validate(
      conversationInputSchema.partial().required({ title: true }),
      request.body,
      reply
    );
    if (!patch) return;
    const conversation = app.db.conversations.rename(request.params.id, patch.title);
    if (!conversation) {
      notFound(reply, `conversation ${request.params.id} not found`);
      return;
    }
    return conversation;
  });

  app.delete<IdParams>("/conversations/:id", async (request, reply) => {
    if (!app.db.conversations.remove(request.params.id)) {
      notFound(reply, `conversation ${request.params.id} not found`);
      return;
    }
    reply.code(204);
    return;
  });
}

export function registerMessagesRoutes(app: FastifyInstance): void {
  app.get<IdParams>("/conversations/:id/messages", async (request, reply) => {
    const conversation = app.db.conversations.byId(request.params.id);
    if (!conversation) {
      notFound(reply, `conversation ${request.params.id} not found`);
      return;
    }
    return app.db.messages.listByConversation(request.params.id);
  });
}

export function registerTasksRoutes(app: FastifyInstance): void {
  app.get("/tasks", async () => app.db.tasks.list());

  app.post("/tasks", async (request, reply) => {
    const input = validate(taskInputSchema, request.body, reply);
    if (!input) return;
    if (!app.db.agents.byId(input.agentId)) {
      notFound(reply, `agent ${input.agentId} not found`);
      return;
    }
    const task = app.db.tasks.create(input);
    reply.code(201);
    return task;
  });

  app.patch<IdParams>("/tasks/:id", async (request, reply) => {
    const patch = validate(taskInputSchema.partial(), request.body, reply);
    if (!patch) return;
    const task = app.db.tasks.update(request.params.id, patch);
    if (!task) {
      notFound(reply, `task ${request.params.id} not found`);
      return;
    }
    return task;
  });

  app.delete<IdParams>("/tasks/:id", async (request, reply) => {
    if (!app.db.tasks.remove(request.params.id)) {
      notFound(reply, `task ${request.params.id} not found`);
      return;
    }
    reply.code(204);
    return;
  });
}

export function registerMemoryRoutes(app: FastifyInstance): void {
  app.get<IdParams>("/agents/:id/memory", async (request, reply) => {
    const agent = app.db.agents.byId(request.params.id);
    if (!agent) {
      notFound(reply, `agent ${request.params.id} not found`);
      return;
    }
    return app.db.memory.list(request.params.id);
  });

  app.post("/memory", async (request, reply) => {
    const input = validate(memoryInputSchema, request.body, reply);
    if (!input) return;
    if (!app.db.agents.byId(input.agentId)) {
      notFound(reply, `agent ${input.agentId} not found`);
      return;
    }
    const memory = app.db.memory.create(input);
    reply.code(201);
    return memory;
  });

  app.delete<IdParams>("/memory/:id", async (request, reply) => {
    if (!app.db.memory.remove(request.params.id)) {
      notFound(reply, `memory ${request.params.id} not found`);
      return;
    }
    reply.code(204);
    return;
  });
}