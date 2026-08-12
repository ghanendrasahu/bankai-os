import type { AgentRuntime } from "@bankai/agent";
import type { Task } from "@bankai/contracts";
import { newId } from "@bankai/contracts";
import type { BankaiDb } from "@bankai/db";
import cron from "node-cron";
import type { ScheduledTask } from "node-cron";

export interface TaskSchedulerOptions {
  db: BankaiDb;
  runtime: AgentRuntime;
  logger?: (message: string) => void;
  sweepIntervalMs?: number;
}

interface JobEntry {
  task: Task;
  job: ScheduledTask;
}

export class TaskScheduler {
  private readonly db: BankaiDb;
  private readonly runtime: AgentRuntime;
  private readonly log: (message: string) => void;
  private readonly jobs = new Map<string, JobEntry>();
  private running = false;
  private sweepTimer: NodeJS.Timeout | undefined;

  constructor(options: TaskSchedulerOptions) {
    this.db = options.db;
    this.runtime = options.runtime;
    this.log = options.logger ?? ((message) => console.log(`[tasks] ${message}`));
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.resync();
    this.sweepTimer = setInterval(() => this.resync(), this.sweepInterval());
  }

  stop(): void {
    this.running = false;
    if (this.sweepTimer) clearInterval(this.sweepTimer);
    this.sweepTimer = undefined;
    for (const entry of this.jobs.values()) entry.job.stop();
    this.jobs.clear();
  }

  refresh(): void {
    this.resync();
  }

  private sweepInterval(): number {
    return 30_000;
  }

  private resync(): void {
    const tasks = this.db.tasks.list(true);
    const current = new Set(this.jobs.keys());
    const next = new Set(tasks.map((task) => task.id));

    for (const id of current) {
      if (!next.has(id)) this.removeJob(id);
    }
    for (const task of tasks) {
      if (!current.has(task.id)) {
        this.scheduleJob(task);
      } else {
        const existing = this.jobs.get(task.id)?.task;
        if (existing && scheduleFingerprint(existing) !== scheduleFingerprint(task)) {
          this.removeJob(task.id);
          this.scheduleJob(task);
        }
      }
    }
  }

  private removeJob(id: string): void {
    const entry = this.jobs.get(id);
    if (!entry) return;
    entry.job.stop();
    this.jobs.delete(id);
  }

  private scheduleJob(task: Task): void {
    if (!cron.validate(task.cron)) {
      this.log(`task ${task.id} has invalid cron expression, skipping: ${task.cron}`);
      return;
    }
    const job = cron.schedule(task.cron, () => void this.runTask(task), { noOverlap: true, unref: true });
    this.jobs.set(task.id, { task, job });
    this.log(`scheduled task ${task.id} (${task.name}) ${task.cron}`);
  }

  private async runTask(task: Task): Promise<void> {
    const agent = this.db.agents.byId(task.agentId);
    if (!agent || !agent.enabled) {
      this.log(`task ${task.id} skipped: agent ${task.agentId} missing or disabled`);
      return;
    }

    const now = new Date().toISOString();
    const run = this.db.runs.create({
      id: newId("run"),
      agentId: task.agentId,
      conversationId: null,
      requestId: `task:${task.id}:${Date.now()}`,
      prompt: task.prompt,
    });

    this.log(`task ${task.id} fired -> run ${run.id}`);
    try {
      for await (const event of this.runtime.run(run.id)) {
        if (event.type === "failed") {
          this.log(`task ${task.id} run ${run.id} failed: ${event.error}`);
        }
      }
    } catch (error) {
      this.log(`task ${task.id} run ${run.id} errored: ${error instanceof Error ? error.message : String(error)}`);
    }
    this.db.tasks.setLastRun(task.id, new Date().toISOString());
  }
}

function scheduleFingerprint(task: Task): string {
  return `${task.cron}|${task.prompt}|${task.agentId}`;
}