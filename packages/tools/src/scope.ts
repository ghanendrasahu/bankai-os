import dns from "node:dns/promises";
import { mkdirSync } from "node:fs";
import { isIP } from "node:net";
import path from "node:path";
import type { ToolContext } from "./types.js";

/**
 * Lab target scoping for the security tools.
 *
 * The structured tools (port_scan, http_request) resolve their targets and
 * refuse anything outside the configured lab ranges. The scope lives in a
 * single, explicit configuration - the `lab.cidr` setting or `LAB_CIDR`
 * environment variable - so authorized ranges are a deliberate choice, not a
 * per-command nag. Loopback and `*.lab` hostnames are always allowed.
 */

const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export interface Cidr {
  prefix: number;
  /** Packed IPv4 address as an unsigned 32-bit integer. */
  base: number;
  raw: string;
}

/** Convert a dotted IPv4 address to an unsigned 32-bit int. NaN when invalid. */
export function ipv4ToUint32(ip: string): number {
  const parts = ip.split(".");
  if (parts.length !== 4) return Number.NaN;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return Number.NaN;
    const octet = Number(part);
    if (octet > 255) return Number.NaN;
    value = value * 256 + octet;
  }
  return value >>> 0;
}

/** Parse a single CIDR block like "192.168.1.0/24" or bare IPv4 (/32). */
export function parseCidr(entry: string): Cidr | undefined {
  const [address, prefixRaw] = entry.split("/");
  const base = ipv4ToUint32(address ?? "");
  if (Number.isNaN(base)) return undefined;
  const prefix = prefixRaw === undefined ? 32 : Number(prefixRaw);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return undefined;
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return { prefix, base: (base & mask) >>> 0, raw: entry.trim() };
}

/** True when the IPv4 address falls inside the CIDR block. */
export function inCidr(ip: string, cidr: Cidr): boolean {
  const value = ipv4ToUint32(ip);
  if (Number.isNaN(value)) return false;
  const mask = cidr.prefix === 0 ? 0 : (0xffffffff << (32 - cidr.prefix)) >>> 0;
  return ((value & mask) >>> 0) === cidr.base;
}

export function resolveLabCidrs(
  ctx: Pick<ToolContext, "db">,
  env: Record<string, string | undefined> = process.env
): Cidr[] {
  const configured = env.LAB_CIDR ?? ctx.db.settings.all()["lab.cidr"] ?? "";
  const cidrs: Cidr[] = [];
  for (const entry of configured.split(/[\s,]+/)) {
    if (!entry) continue;
    const cidr = parseCidr(entry);
    if (cidr) cidrs.push(cidr);
  }
  return cidrs;
}

export function labWorkspace(agentId: string): string {
  const root = process.env.LAB_WORKSPACE ?? path.join(process.cwd(), "security");
  const dir = path.join(root, agentId);
  mkdirSync(dir, { recursive: true });
  return dir;
}

export interface TargetCheck {
  ok: boolean;
  reason: string;
}

export function unconfiguredScope(): TargetCheck {
  return {
    ok: false,
    reason:
      "error: lab scope is not configured - set the lab.cidr setting or the LAB_CIDR " +
      "environment variable (comma separated CIDRs, e.g. 192.168.1.0/24,10.0.0.0/8). " +
      "Only add ranges you own or are authorized to test.",
  };
}

export function outOfScope(target: string, detail?: string): TargetCheck {
  return {
    ok: false,
    reason:
      `error: target ${target} is outside the configured lab scope. Set lab.cidr / ` +
      "LAB_CIDR to explicitly authorize a range you own or have permission to test." +
      (detail ? ` (${detail})` : ""),
  };
}

function isLoopback(target: string): boolean {
  const bare = target.replace(/^\[|\]$/g, "").toLowerCase();
  if (LOOPBACK_HOSTNAMES.has(bare)) return true;
  if (bare === "::1" || bare === "0:0:0:0:0:0:0:1") return true;
  const v4 = ipv4ToUint32(bare);
  if (!Number.isNaN(v4)) return (v4 & 0xff000000) === (127 << 24 >>> 0);
  return false;
}

function isLabHostname(target: string): boolean {
  const bare = target.replace(/^\[|\]$/g, "").toLowerCase();
  return bare.endsWith(".lab") || bare.endsWith(".lab.local");
}

async function resolveHostname(target: string): Promise<string[]> {
  try {
    const records = await dns.lookup(target.replace(/^\[|\]$/g, ""), { all: true });
    return records.map((record) => record.address);
  } catch {
    return [];
  }
}

/**
 * Check one explicit tool target against the lab scope. Structure:
 * - loopback and *.lab names: always OK (they are the operator's own box)
 * - otherwise: the target (after resolution) must fall inside the
 *   deliberately configured lab CIDRs.
 */
export async function assertTarget(
  ctx: Pick<ToolContext, "db">,
  target: string
): Promise<TargetCheck> {
  if (isLoopback(target)) return { ok: true, reason: "loopback" };
  if (isLabHostname(target)) return { ok: true, reason: ".lab hostname" };

  const cidrs = resolveLabCidrs(ctx);
  if (cidrs.length === 0) return unconfiguredScope();

  const bare = target.replace(/^\[|\]$/g, "");
  const kind = isIP(bare);
  if (kind === 4) {
    return cidrs.some((cidr) => inCidr(target, cidr))
      ? { ok: true, reason: "within lab cidr" }
      : outOfScope(target);
  }
  if (kind === 6) return outOfScope(target, "IPv6 targets are not part of the lab scope");

  // CIDR ranges ("10.0.0.0/24") pass through as targets too: they are valid
  // when every address in the requested block lies inside an allowed block.
  const asCidr = parseCidr(bare);
  if (asCidr) {
    const tMask = asCidr.prefix === 0 ? 0 : (0xffffffff << (32 - asCidr.prefix)) >>> 0;
    const tBroadcast = (asCidr.base | ~tMask) >>> 0;
    return cidrs.some((cidr) => {
      const aMask = cidr.prefix === 0 ? 0 : (0xffffffff << (32 - cidr.prefix)) >>> 0;
      const aBroadcast = (cidr.base | ~aMask) >>> 0;
      return asCidr.base >= cidr.base && tBroadcast <= aBroadcast;
    })
      ? { ok: true, reason: "cidr within lab scope" }
      : outOfScope(target);
  }

  const addresses = await resolveHostname(target);
  if (addresses.length === 0) {
    return outOfScope(target, "could not resolve; refusing offline guesses as lab targets");
  }
  const outside = addresses.filter((ip) => {
    if (isLoopback(ip)) return false;
    if (isIP(ip) === 6) return true;
    return !cidrs.some((cidr) => inCidr(ip, cidr));
  });
  return outside.length === 0
    ? { ok: true, reason: `resolved ${addresses.join(", ")} inside lab scope` }
    : outOfScope(target, `resolved outside lab scope: ${outside.join(", ")}`);
}

/** Quote-aware argv splitter for passing extra CLI flags through a single string. */
export function tokenizeExtraArgs(input: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: string | undefined;
  for (const char of input) {
    if (quote) {
      if (char === quote) quote = undefined;
      else current += char;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === " " || char === "\t") {
      if (current) tokens.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  if (current) tokens.push(current);
  return tokens;
}
