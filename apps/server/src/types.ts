import type { BankaiConfig } from "@bankai/config";
import type { BankaiDb } from "@bankai/db";

declare module "fastify" {
  interface FastifyInstance {
    db: BankaiDb;
    config: BankaiConfig;
  }
  interface FastifyRequest {
    token?: string;
  }
}