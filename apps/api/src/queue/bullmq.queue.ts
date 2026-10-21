import { Logger } from '@nestjs/common';
import { Queue, Worker, type ConnectionOptions } from 'bullmq';
import type { JobHandlers, JobName, JobQueue, Repeat } from './queue.js';

const QUEUE_NAME = 'techfix';
const ADD_TIMEOUT_MS = 1500;

/** Parses redis://[:password@]host:port[/db] (rediss:// for TLS) into BullMQ connection options. */
export function redisConnection(url: string, forWorker = true): ConnectionOptions {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port || 6379),
    ...(u.username ? { username: decodeURIComponent(u.username) } : {}),
    ...(u.password ? { password: decodeURIComponent(u.password) } : {}),
    ...(u.pathname.length > 1 ? { db: Number(u.pathname.slice(1)) } : {}),
    ...(u.protocol === 'rediss:' ? { tls: {} } : {}),
    // Workers must wait for Redis forever (BullMQ requires null). A publisher must not: a request
    // handler gives up quickly and relies on the outbox sweep instead of hanging.
    ...(forWorker
      ? { maxRetriesPerRequest: null }
      : { maxRetriesPerRequest: 1, enableOfflineQueue: false }),
  };
}

/** Production queue on Redis. Publishing is cheap in every process; the worker only runs where asked. */
export class BullMqQueue implements JobQueue {
  readonly driver = 'bullmq' as const;
  private handlers: JobHandlers | null = null;
  private worker: Worker | null = null;
  private readonly queue: Queue;
  private readonly log = new Logger('BullMqQueue');

  constructor(
    private readonly url: string,
    private readonly prefix = 'techfix',
  ) {
    this.queue = new Queue(QUEUE_NAME, {
      connection: redisConnection(url, false),
      prefix,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
    });
    this.queue.on('error', (e) => this.log.warn(`redis: ${e.message}`));
  }

  register(handlers: JobHandlers) {
    this.handlers = handlers;
  }

  async add(name: JobName, data: Record<string, unknown>) {
    try {
      // BullMQ waits for the connection before it even tries, so the bound has to be ours.
      let timer: NodeJS.Timeout | undefined;
      const timeout = new Promise<never>((_, rej) => {
        timer = setTimeout(() => rej(new Error('redis timeout')), ADD_TIMEOUT_MS);
      });
      try {
        await Promise.race([this.queue.add(name, data), timeout]);
      } finally {
        clearTimeout(timer);
      }
    } catch (e) {
      // Redis is down: the outbox row is already saved, the sweep delivers it once the worker is back.
      this.log.warn(`could not enqueue ${name}: ${(e as Error).message}`);
    }
  }

  async startWorkers(repeats: Repeat[]) {
    if (this.worker) return;
    this.worker = new Worker(
      QUEUE_NAME,
      async (job) => {
        const h = this.handlers?.[job.name as JobName];
        if (!h) throw new Error(`no handler for ${job.name}`);
        await h((job.data ?? {}) as Record<string, unknown>);
      },
      { connection: redisConnection(this.url), prefix: this.prefix, concurrency: 5 },
    );
    this.worker.on('error', (e) => this.log.warn(`worker: ${e.message}`));
    this.worker.on('failed', (job, e) => this.log.warn(`${job?.name} failed: ${e.message}`));
    for (const r of repeats)
      await this.queue.upsertJobScheduler(r.name, { every: r.everyMs }, { name: r.name, data: {} });
  }

  async close() {
    await this.worker?.close();
    // Closing while Redis is down must not keep the process alive.
    await Promise.race([this.queue.close(), new Promise((r) => setTimeout(r, 2000))]);
  }
}
