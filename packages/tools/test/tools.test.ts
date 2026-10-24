import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { BankaiDb } from "@bankai/db";
import { httpRequestTool, reportWriteTool, runCommandTool } from "../src/index.js";

describe("lab security tools", () => {
  let workspace: string;
  let db: BankaiDb;

  beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), "bankai-lab-"));
    process.env.LAB_WORKSPACE = workspace;
    db = new BankaiDb({ dbPath: ":memory:" });
  });

  afterEach(() => {
    delete process.env.LAB_WORKSPACE;
  });

  it("run_command executes arbitrary programs and returns their output", async () => {
    const output = await runCommandTool.execute(
      { command: `node -e "console.log('hello-bankai')"` },
      { agentId: "ag_test", db }
    );
    expect(output).toContain("exit: 0");
    expect(output).toContain("hello-bankai");
  });

  it("run_command surfaces failing commands as data, not dead ends", async () => {
    const output = await runCommandTool.execute(
      { command: "node -e \"process.exit(3)\"" },
      { agentId: "ag_test", db }
    );
    expect(output).toContain("error: command failed");
    expect(output).toContain("exit: 3");
  });

  it("report_write saves markdown into the agent workspace", async () => {
    const result = await reportWriteTool.execute(
      { filename: "recon-summary", content: "# findings" },
      { agentId: "ag_test", db }
    );
    expect(result).toContain("saved");
    const savedPath = /saved (\S+\.md)/.exec(result)?.[1] ?? "";
    const saved = readFileSync(savedPath, "utf8");
    expect(saved).toBe("# findings");
  });

  it("http_request refuses explicit public targets outside the lab scope", async () => {
    db.settings.setMany({ "lab.cidr": "192.168.1.0/24" });
    const output = await httpRequestTool.execute(
      { url: "http://93.184.216.34/" },
      { agentId: "ag_test", db }
    );
    expect(output).toContain("outside the configured lab scope");
  });

  it("http_request reaches loopback targets without scope friction", async () => {
    db.settings.setMany({ "lab.cidr": "192.168.1.0/24" });
    const output = await httpRequestTool.execute(
      { url: "http://127.0.0.1:9/" },
      { agentId: "ag_test", db }
    );
    // Nothing listens on port 9 - but loopback passes scoping and the failure
    // is returned as a connection error, not a scope refusal.
    expect(output.startsWith("error:")).toBe(true);
    expect(output).not.toContain("lab scope");
  }, 20_000);
});
