import type { FastifyInstance } from "fastify";
import { registerAgentsRoutes, registerConversationsRoutes, registerMemoryRoutes, registerMessagesRoutes, registerTasksRoutes } from "./entities.js";
import { registerRunsRoutes } from "./runs.js";
import { registerSettingsRoutes } from "./settings.js";
import { registerStreamRoutes } from "./stream.js";

export function registerRoutes(app: FastifyInstance): void {
  registerAgentsRoutes(app);
  registerConversationsRoutes(app);
  registerMessagesRoutes(app);
  registerTasksRoutes(app);
  registerMemoryRoutes(app);
  registerRunsRoutes(app);
  registerSettingsRoutes(app);
  registerStreamRoutes(app);
}