import type { AgentRuntime } from "@bankai/agent";
import { AgentRuntime as AgentRuntimeImpl } from "@bankai/agent";
import type { BankaiConfig } from "@bankai/config";
import type { BankaiDb } from "@bankai/db";
import type { TaskScheduler } from "@bankai/tasks";
import type { FastifyError, FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { requireAuth } from "./auth.js";
import { registerRoutes } from "./routes/index.js";
import type { ApiError } from "./errors.js";

export interface BuildServerOptions {
  config: BankaiConfig;
  db: BankaiDb;
  scheduler: TaskScheduler;
}

export async function buildServer({ config, db, scheduler }: BuildServerOptions) {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      redact: { paths: ["req.headers.authorization"], censor: "[REDACTED]" },
    },
    requestIdHeader: "x-request-id",
  });

  app.decorate("config", config);
  app.decorate("db", db);
  app.decorate("scheduler", scheduler);
  const runtime: AgentRuntime = new AgentRuntimeImpl(db);
  app.decorate("runtime", runtime);
  app.decorate("runAborts", new Map<string, AbortController>());

  app.register(cors, { origin: true, methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"] });

  app.addContentTypeParser("application/json", { parseAs: "buffer" }, (_request, body, done) => {
    try {
      const text = body.toString("utf8").trim();
      done(null, text ? JSON.parse(text) : undefined);
    } catch (error) {
      done(error as Error, undefined);
    }
  });

  app.addHook("onRequest", requireAuth);

  app.setErrorHandler((error: FastifyError, request, reply) => {
    request.log.error({ err: error }, "request failed");
    const body: ApiError = {
      code: (error as { code?: string }).code ?? "internal_error",
      message: (error.statusCode ?? 500) >= 500 ? "internal error" : error.message,
    };
    reply.code(error.statusCode ?? 500).send({ error: body });
  });

  app.get("/health", async () => {
    return { status: "ok", uptime: process.uptime() };
  });

  app.get("/ready", async (_request, reply) => {
    // Readiness = the process is up *and* its dependencies answer.
    const database = app.db.ping();
    const ready = database;
    return reply.code(ready ? 200 : 503).send({
      status: ready ? "ready" : "unavailable",
      checks: { database: database ? "up" : "down" },
    });
  });

  app.register(
    async (scoped) => {
      registerRoutes(scoped);
    },
    { prefix: "/api" }
  );

  await registerStaticSpa(app);

  return app;
}

async function registerStaticSpa(app: FastifyInstance): Promise<void> {
  const distDir = fileURLToPath(new URL("../../dashboard/dist", import.meta.url));
  const hasStatic = existsSync(distDir);

  if (hasStatic) {
    // default wildcard mode: serves every existing file under dist with the
    // correct content-type (the old `wildcard: false` served only "/" and
    // answered asset requests, like the JS bundle, with index.html)
    await app.register(fastifyStatic, { root: distDir, index: ["index.html"] });
  }

  app.setNotFoundHandler((request, reply) => {
    if (request.method === "GET" && hasStatic) {
      void reply.sendFile("index.html");
      return;
    }
    reply.code(404).send({ error: { code: "not_found", message: `route ${request.method} ${request.url} not found` } });
  });
}