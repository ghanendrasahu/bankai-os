import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_MODEL } from "@bankai/contracts";

import { BankaiDb } from "../src/db.js";
import { seedDefaults } from "../src/seed.js";

/**
 * Real repository tests against an in-memory SQLite database - the same code
 * path production uses, minus the file on disk.
 */
describe("bankai db repositories", () => {
  let db: BankaiDb;

  beforeEach(() => {
    db = new BankaiDb({ dbPath: ":memory:" });
  });

  it("creates an agent and finds it by id", () => {
    const created = db.agents.create({
      name: "Researcher",
      description: "finds things",
      systemPrompt: "you research",
      model: "test-model",
      tools: ["web_search"],
      enabled: true,
    });

    expect(created.name).toBe("Researcher");
    expect(created.tools).toEqual(["web_search"]);
    expect(db.agents.byId(created.id)?.name).toBe("Researcher");
    expect(db.agents.byId("does-not-exist")).toBeUndefined();
  });

  it("lists agents ordered by name and can filter the disabled ones", () => {
    db.agents.create({
      name: "Zeta",
      description: "",
      systemPrompt: "",
      model: "test-model",
      tools: [],
      enabled: false,
    });
    db.agents.create({
      name: "Alpha",
      description: "",
      systemPrompt: "",
      model: "test-model",
      tools: [],
      enabled: true,
    });

    expect(db.agents.list().map((agent) => agent.name)).toEqual(["Alpha", "Zeta"]);
    expect(db.agents.list(true).map((agent) => agent.name)).toEqual(["Alpha"]);
  });

  it("updates and removes an agent", () => {
    const created = db.agents.create({
      name: "Draft",
      description: "",
      systemPrompt: "",
      model: "test-model",
      tools: [],
      enabled: true,
    });

    const updated = db.agents.update(created.id, { name: "Final", enabled: false });
    expect(updated?.name).toBe("Final");
    expect(updated?.enabled).toBe(false);

    expect(db.agents.remove(created.id)).toBe(true);
    expect(db.agents.byId(created.id)).toBeUndefined();
    expect(db.agents.remove(created.id)).toBe(false);
  });

  it("stores, reads and deletes settings", () => {
    db.settings.setMany({ theme: "dark", locale: "en" });

    expect(db.settings.all()).toMatchObject({ theme: "dark", locale: "en" });

    expect(db.settings.delete("locale")).toBe(true);
    expect(db.settings.delete("locale")).toBe(false);
    expect(db.settings.all()).toMatchObject({ theme: "dark" });
    expect(db.settings.all()).not.toHaveProperty("locale");
  });

  it("keeps conversations scoped to their agent", () => {
    const agent = db.agents.create({
      name: "Owner",
      description: "",
      systemPrompt: "",
      model: "test-model",
      tools: [],
      enabled: true,
    });

    db.conversations.create({ agentId: agent.id, title: "First" });

    expect(db.conversations.list(agent.id)).toHaveLength(1);
    expect(db.conversations.list("other-agent")).toHaveLength(0);
  });

  it("seeds a ready-to-use default agent and starter chat on an empty database", () => {
    expect(seedDefaults(db)).toBe(true);

    const agents = db.agents.list();
    expect(agents).toHaveLength(1);
    expect(agents[0]?.name).toBe("Bankai");
    expect(agents[0]?.model).toBe(DEFAULT_MODEL);
    expect(agents[0]?.enabled).toBe(true);
    expect(agents[0]?.tools).toContain("time");

    const conversations = db.conversations.list();
    expect(conversations).toHaveLength(1);
    expect(conversations[0]?.agentId).toBe(agents[0]?.id);
    expect(conversations[0]?.title).toBe("New chat");
  });

  it("leaves an existing database untouched when seeding", () => {
    db.agents.create({
      name: "Mine",
      description: "",
      systemPrompt: "",
      model: "custom-model",
      tools: [],
      enabled: true,
    });

    expect(seedDefaults(db)).toBe(false);
    expect(db.agents.list().map((agent) => agent.name)).toEqual(["Mine"]);
    expect(db.conversations.list()).toHaveLength(0);
  });
});
