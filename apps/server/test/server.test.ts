import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildServer } from "../src/app.js";

const TOKEN = "test-token";

/** Minimal in-memory stand-in for the persistence layer. */
function fakeDb() {
  const settings = new Map<string, string>();
  return {
    settings: {
      all: () => Object.fromEntries(settings),
      setMany: (entries: Record<string, string>) => {
        for (const [key, value] of Object.entries(entries)) settings.set(key, value);
      },
      delete: (key: string) => settings.delete(key),
    },
    agents: {
      list: () => [],
      byId: () => undefined,
      create: () => ({}),
      update: () => undefined,
      remove: () => true,
    },
    conversations: {
      list: () => [],
      byId: () => undefined,
      create: () => ({}),
      rename: () => undefined,
      remove: () => true,
    },
  };
}

async function build(token: string | undefined): Promise<FastifyInstance> {
  const app = await buildServer({
    config: { BANKAI_TOKEN: token, LOG_LEVEL: "silent" } as never,
    db: fakeDb() as never,
    scheduler: {} as never,
  });
  await app.ready();
  return app;
}

describe("bankai server", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await build(TOKEN);
  });

  afterEach(async () => {
    await app.close();
  });

  it("serves the health probe without authentication", async () => {
    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "ok" });
  });

  it("rejects api calls without a bearer token", async () => {
    const response = await app.inject({ method: "GET", url: "/api/settings" });

    expect(response.statusCode).toBe(401);
  });

  it("rejects api calls with the wrong token", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/settings",
      headers: { authorization: "Bearer nope" },
    });

    expect(response.statusCode).toBe(401);
  });

  it("rejects a malformed authorization header", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/settings",
      headers: { authorization: TOKEN },
    });

    expect(response.statusCode).toBe(401);
  });

  it("accepts a valid bearer token", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/settings",
      headers: { authorization: `Bearer ${TOKEN}` },
    });

    expect(response.statusCode).toBe(200);
  });

  it("validates the settings payload", async () => {
    const response = await app.inject({
      method: "PUT",
      url: "/api/settings",
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { theme: "dark" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ theme: "dark" });
  });

  it("rejects an empty settings payload", async () => {
    const response = await app.inject({
      method: "PUT",
      url: "/api/settings",
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBeTruthy();
  });

  it("returns a structured 404 for unknown routes", async () => {
    // GET falls back to the SPA when a dashboard build is present, so the
    // JSON error path is asserted with a non-GET request.
    const response = await app.inject({
      method: "POST",
      url: "/api/nope",
      headers: { authorization: `Bearer ${TOKEN}` },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error).toMatchObject({ code: "not_found" });
  });

  it("authenticates before routing", async () => {
    // The auth hook runs on every /api request, so even an unknown route
    // answers 401 rather than leaking which routes exist.
    const response = await app.inject({ method: "GET", url: "/api/nope" });

    expect(response.statusCode).toBe(401);
  });

  it("leaves the api open when no token is configured", async () => {
    const open = await build(undefined);

    try {
      const response = await open.inject({ method: "GET", url: "/api/settings" });
      expect(response.statusCode).toBe(200);
    } finally {
      await open.close();
    }
  });
});
