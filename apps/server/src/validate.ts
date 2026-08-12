import type { FastifyReply } from "fastify";
import type { z } from "zod";
import { badRequest } from "./errors.js";

export function validate<S extends z.ZodTypeAny>(
  schema: S,
  data: unknown,
  reply: FastifyReply
): z.output<S> | null {
  const result = schema.safeParse(data);
  if (!result.success) {
    const message = result.error.issues
      .map((issue) => `${issue.path.join(".") || "value"}: ${issue.message}`)
      .join("; ");
    badRequest(reply, message);
    return null;
  }
  return result.data;
}