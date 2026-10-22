import { describe, expect, it } from "vitest";

import {
  agentInputSchema,
  runStatusSchema,
  settingsEntriesSchema,
  settingsSetSchema,
} from "../src/index.js";

describe("agentInputSchema", () => {
  it("applies the documented defaults", () => {
    const parsed = agentInputSchema.parse({ name: "Researcher" });

    expect(parsed.description).toBe("");
    expect(parsed.systemPrompt).toBe("");
    expect(parsed.tools).toEqual([]);
    expect(parsed.enabled).toBe(true);
  });

  it("requires a name", () => {
    expect(agentInputSchema.safeParse({ name: "" }).success).toBe(false);
    expect(agentInputSchema.safeParse({}).success).toBe(false);
  });

  it("rejects a non-string tool list", () => {
    expect(agentInputSchema.safeParse({ name: "x", tools: [1] }).success).toBe(false);
  });
});

describe("settings schemas", () => {
  it("accepts a non-empty string map", () => {
    expect(settingsSetSchema.safeParse({ theme: "dark" }).success).toBe(true);
  });

  it("rejects an empty map", () => {
    expect(settingsSetSchema.safeParse({}).success).toBe(false);
  });

  it("rejects non-string values", () => {
    expect(settingsEntriesSchema.safeParse({ retries: 3 }).success).toBe(false);
  });
});

describe("runStatusSchema", () => {
  it("accepts the known statuses", () => {
    for (const status of ["queued", "running", "completed", "failed", "cancelled", "interrupted"]) {
      expect(runStatusSchema.safeParse(status).success).toBe(true);
    }
  });

  it("rejects an unknown status", () => {
    expect(runStatusSchema.safeParse("exploded").success).toBe(false);
  });
});
