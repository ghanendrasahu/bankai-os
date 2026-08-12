import type { AgentRuntime } from "@bankai/agent";
import type { BankaiConfig } from "@bankai/config";
import type { BankaiDb } from "@bankai/db";

declare module "fastify" {
  interface FastifyInstance {
    db: BankaiDb;
    config: BankaiConfig;
    runtime: AgentRuntime;
    runAborts: Map<string, AbortController>;
  }
  interface FastifyRequest {
    token?: string;
  }
}