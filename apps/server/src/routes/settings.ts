import { settingsSetSchema } from "@bankai/contracts";
import type { FastifyInstance } from "fastify";
import { notFound } from "../errors.js";
import { validate } from "../validate.js";

type KeyParams = { Params: { key: string } };

/** Placeholder returned instead of a stored credential. */
export const MASKED_VALUE = "********";
const SECRET_KEY = /(api[_-]?key|token|secret|password)/i;

function maskSecret(key: string, value: string): string {
  return value && SECRET_KEY.test(key) ? MASKED_VALUE : value;
}

function maskSettings(entries: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(entries).map(([key, value]) => [key, maskSecret(key, value)])
  );
}

export function registerSettingsRoutes(app: FastifyInstance): void {
  // Never return provider keys or tokens to the browser, even to an
  // authenticated caller: the dashboard only needs to know they exist.
  app.get("/settings", async () => maskSettings(app.db.settings.all()));

  app.put("/settings", async (request, reply) => {
    const entries = validate(settingsSetSchema, request.body, reply);
    if (!entries) return;
    // Saving the masked placeholder must not overwrite the real secret.
    const safeEntries = Object.fromEntries(
      Object.entries(entries).filter(([, value]) => value !== MASKED_VALUE)
    );
    app.db.settings.setMany(safeEntries);
    return maskSettings(app.db.settings.all());
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
