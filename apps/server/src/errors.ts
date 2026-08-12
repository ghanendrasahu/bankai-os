import type { FastifyReply } from "fastify";

export interface ApiError {
  code: string;
  message: string;
}

export function sendError(reply: FastifyReply, status: number, code: string, message: string): void {
  reply.code(status).send({ error: { code, message } });
}

export function badRequest(reply: FastifyReply, message: string): void {
  sendError(reply, 400, "bad_request", message);
}

export function notFound(reply: FastifyReply, message: string): void {
  sendError(reply, 404, "not_found", message);
}

export function unauthorized(reply: FastifyReply, message = "missing or invalid token"): void {
  sendError(reply, 401, "unauthorized", message);
}

export function conflict(reply: FastifyReply, message: string): void {
  sendError(reply, 409, "conflict", message);
}