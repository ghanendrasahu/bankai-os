import type { FastifyInstance } from "fastify";
import type { ServerResponse } from "node:http";
import { badRequest, notFound } from "../errors.js";

type IdParams = { Params: { id: string } };

function writeSse(res: ServerResponse, eventName: string, data: unknown): void {
  res.write(`event: ${eventName}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export function registerStreamRoutes(app: FastifyInstance): void {
  app.post<IdParams>("/runs/:id/stream", async (request, reply) => {
    const run = app.db.runs.byId(request.params.id);
    if (!run) {
      notFound(reply, `run ${request.params.id} not found`);
      return;
    }
    if (run.status !== "queued" && run.status !== "running") {
      badRequest(reply, `run already finished (${run.status})`);
      return;
    }

    const res = reply.raw;
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    });
    res.flushHeaders?.();

    const abort = new AbortController();
    app.runAborts.set(run.id, abort);

    res.on("close", () => {
      if (!res.writableEnded) abort.abort();
    });

    try {
      for await (const event of app.runtime.run(run.id, abort.signal)) {
        if (res.destroyed) {
          abort.abort();
          break;
        }
        writeSse(res, event.type, event);
      }
    } finally {
      app.runAborts.delete(run.id);
      res.end();
    }
  });
}