import { loadConfig } from "@bankai/config";
import { BankaiDb, seedDefaults, seedSecurityAgent } from "@bankai/db";
import { AgentRuntime } from "@bankai/agent";
import { TaskScheduler } from "@bankai/tasks";
import { buildServer } from "./app.js";
import "./types.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const db = new BankaiDb({ dbPath: config.dbPath });

  if (seedDefaults(db)) {
    console.log("Seeded default agent 'Bankai' with a starter chat");
  }
  if (seedSecurityAgent(db)) {
    console.log("Seeded lab security agent 'Recon' (configure lab.cidr or LAB_CIDR to unlock scans)");
  }

  const interrupted = db.recoverInterruptedRuns();
  if (interrupted > 0) {
    console.log(`Marked ${interrupted} interrupted run(s) after restart`);
  }

  const runtime = new AgentRuntime(db);
  const scheduler = new TaskScheduler({ db, runtime });
  const app = await buildServer({ config, db, scheduler });
  await app.listen({ host: config.HOST, port: config.PORT });

  scheduler.start();

  async function shutdown(signal: string): Promise<void> {
    app.log.info(`${signal} received, shutting down`);
    scheduler.stop();
    await app.close();
    db.close();
    process.exit(0);
  }

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((error) => {
  console.error("fatal: failed to start server", error);
  process.exit(1);
});