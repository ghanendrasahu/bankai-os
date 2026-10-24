import { beforeEach, describe, expect, it } from "vitest";

import { BankaiDb } from "@bankai/db";
import {
  assertTarget,
  inCidr,
  labWorkspace,
  parseCidr,
  tokenizeExtraArgs,
} from "../src/index.js";

const db = new BankaiDb({ dbPath: ":memory:" });

describe("lab scope", () => {
  it("parses CIDR blocks and matches addresses inside them", () => {
    const cidr = parseCidr("192.168.1.0/24");
    expect(cidr).toBeDefined();
    expect(inCidr("192.168.1.50", cidr as NonNullable<typeof cidr>)).toBe(true);
    expect(inCidr("192.168.2.50", cidr as NonNullable<typeof cidr>)).toBe(false);
    expect(inCidr("10.0.0.5", parseCidr("10.0.0.0/8") as NonNullable<typeof cidr>)).toBe(true);
    expect(parseCidr("not-an-ip")).toBeUndefined();
    expect(parseCidr("1.2.3.4/99")).toBeUndefined();
  });

  it("always allows loopback and rejects unconfigured scope with guidance", async () => {
    const loop = await assertTarget({ db }, "127.0.0.1");
    expect(loop.ok).toBe(true);

    const denied = await assertTarget({ db }, "93.184.216.34");
    expect(denied.ok).toBe(false);
    expect(denied.reason).toContain("lab scope is not configured");
  });

  it("allows targets inside the configured lab cidr and denies others", async () => {
    db.settings.setMany({ "lab.cidr": "192.168.1.0/24" });

    const inside = await assertTarget({ db }, "192.168.1.77");
    expect(inside.ok).toBe(true);

    const outside = await assertTarget({ db }, "8.8.8.8");
    expect(outside.ok).toBe(false);
    expect(outside.reason).toContain("outside the configured lab scope");
  });

  it("allows *.lab hostnames without dns", async () => {
    const labHost = await assertTarget({ db }, "kali.lab");
    expect(labHost.ok).toBe(true);
  });

  it("manual-tokenizes extra args like a shell would", () => {
    expect(tokenizeExtraArgs(`-sV -p "22,80,443" --script 'vuln,auth'`)).toEqual([
      "-sV",
      "-p",
      "22,80,443",
      "--script",
      "vuln,auth",
    ]);
  });

  it("workspaces live under LAB_WORKSPACE when set", () => {
    process.env.LAB_WORKSPACE = "C:/tmp/lab-x";
    expect(labWorkspace("ag_1")).toContain("lab-x");
    delete process.env.LAB_WORKSPACE;
  });
});
