import { settingsSetSchema } from "@bankai/contracts";
import type { FastifyInstance } from "fastify";
import { notFound } from "../errors.js";
import { validate } from "../validate.js";

type KeyParams = { Params: { key: string } };

export function registerSettingsRoutes(app: FastifyInstance): void {
  app.get("/settings", async () => app.db.settings.all());

  app.put("/settings", async (request, reply) => {
    const entries = validate(settingsSetSchema, request.body, reply);
    if (!entries) return;
    app.db.settings.setMany(entries);
    return app.db.settings.all();
  });

  app.delete<KeyParams>("/settings/:key", async (request, reply) => {
    if (!app.db.settings.delete(request.params.key)) {
      notFound(reply, `setting ${request.params.key} not found`);
      return;
    }
    reply.code(204);
    return;
  });
}