import { Logger } from '@nestjs/common';

/** Names of the background jobs. A handler gets the job's data and must be safe to run twice. */
export const JOBS = {
  /** Deliver one outbox event (data: { outboxId }). */
  dispatch: 'outbox.dispatch',
  /** Safety net: lease every due outbox row that was never delivered. */
  sweep: 'outbox.sweep',
  /** Ask the payment provider about online payments that are still pending. */
  reconcile: 'payments.reconcile',
} as const;
export type JobName = (typeof JOBS)[keyof typeof JOBS];
export type JobHandlers = Record<JobName, (data: Record<string, unknown>) => Promise<void>>;
export interface Repeat {
  name: JobName;
  everyMs: number;
}

/**
 * The only thing the application knows about queues. `add` is called by request handlers and must
 * never throw into the business flow; `startWorkers` runs only in a process that is meant to work.
 */
export interface JobQueue {
  readonly driver: 'inline' | 'bullmq';
  register(handlers: JobHandlers): void;
  add(name: JobName, data: Record<string, unknown>): Promise<void>;
  startWorkers(repeats: Repeat[]): Promise<void>;
  close(): Promise<void>;
}
export const JOB_QUEUE = Symbol('JOB_QUEUE');

/**
 * No Redis: jobs run right away in this process (tests, local development). If a handler fails the
 * outbox row stays unpublished and the periodic sweep retries it — the same safety net as in production.
 */
export class InlineQueue implements JobQueue {
  readonly driver = 'inline' as const;
  private handlers: JobHandlers | null = null;
  private timers: NodeJS.Timeout[] = [];
  private readonly log = new Logger('InlineQueue');

  register(handlers: JobHandlers) {
    this.handlers = handlers;
  }
  async add(name: JobName, data: Record<string, unknown>) {
    try {
      await this.handlers?.[name](data);
    } catch (e) {
      this.log.warn(`${name} failed: ${(e as Error).message}`);
    }
  }
  async startWorkers(repeats: Repeat[]) {
    for (const r of repeats) {
      const t = setInterval(() => void this.add(r.name, {}), r.everyMs);
      t.unref();
      this.timers.push(t);
    }
  }
  async close() {
    this.timers.forEach(clearInterval);
    this.timers = [];
  }
}
