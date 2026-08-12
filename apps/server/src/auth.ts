import type { FastifyReply, FastifyRequest } from "fastify";
import { unauthorized } from "./errors.js";

function extractToken(request: FastifyRequest): string | undefined {
  const header = request.headers.authorization;
  if (!header) return undefined;
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return undefined;
  return token;
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!request.url.startsWith("/api")) return;
  const token = request.server.config.BANKAI_TOKEN;
  if (!token) return;
  const provided = extractToken(request);
  if (!provided || provided !== token) {
    unauthorized(reply);
    return;
  }
  request.token = provided;
}