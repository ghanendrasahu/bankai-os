import type { BankaiConfig } from "@bankai/config";
import type { BankaiDb } from "@bankai/db";
import type { FastifyError } from "fastify";
import cors from "@fastify/cors";
import Fastify from "fastify";
import { requireAuth } from "./auth.js";
import { registerRoutes } from "./routes/index.js";
import type { ApiError } from "./errors.js";

export interface BuildServerOptions {
  config: BankaiConfig;
  db: BankaiDb;
}

export function buildServer({ config, db }: BuildServerOptions) {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      redact: { paths: ["req.headers.authorization"], censor: "[REDACTED]" },
    },
    requestIdHeader: "x-request-id",
  });

  app.decorate("config", config);
  app.decorate("db", db);

  app.register(cors, { origin: true, methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"] });

  app.addHook("onRequest", requireAuth);

  app.setErrorHandler((error: FastifyError, request, reply) => {
    request.log.error({ err: error }, "request failed");
    const body: ApiError = {
      code: (error as { code?: string }).code ?? "internal_error",
      message: (error.statusCode ?? 500) >= 500 ? "internal error" : error.message,
    };
    reply.code(error.statusCode ?? 500).send({ error: body });
  });

  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send({ error: { code: "not_found", message: `route ${request.method} ${request.url} not found` } });
  });

  app.get("/health", async () => {
    return { status: "ok", uptime: process.uptime() };
  });

  registerRoutes(app);

  return app;
}