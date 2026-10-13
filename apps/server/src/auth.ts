import type { FastifyReply, FastifyRequest } from "fastify";
import type { BankaiConfig } from "@bankai/config";
import { timingSafeEqual } from "node:crypto";
import { unauthorized } from "./errors.js";

function extractToken(request: FastifyRequest): string | undefined {
  const header = request.headers.authorization;
  if (!header) return undefined;
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return undefined;
  return token;
}

/** Constant-time string comparison so the token cannot be guessed by timing. */
function sameToken(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function authIsRequired(config: BankaiConfig): boolean {
  if (config.BANKAI_REQUIRE_AUTH) return config.BANKAI_REQUIRE_AUTH === "true";
  return config.NODE_ENV === "production";
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!request.url.startsWith("/api")) return;
  const token = request.server.config.BANKAI_TOKEN;
  if (!token) {
    if (authIsRequired(request.server.config)) {
      reply.code(503).send({
        error: {
          code: "auth_not_configured",
          message: "Set BANKAI_TOKEN before exposing the API.",
        },
      });
    }
    return;
  }
  const provided = extractToken(request);
  if (!provided || !sameToken(provided, token)) {
    unauthorized(reply);
    return;
  }
  request.token = provided;
}
