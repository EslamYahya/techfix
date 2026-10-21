import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BullMqQueue } from '../src/queue/bullmq.queue.js';
import { JOBS, type JobHandlers } from '../src/queue/queue.js';

/** Needs a real Redis: `REDIS_URL=redis://localhost:6379 pnpm --filter @techfix/api test`. Skipped otherwise. */
const url = process.env['REDIS_URL'];
const suite = url ? describe : describe.skip;

suite('BullMQ queue (real Redis)', () => {
  const prefix = `test-${Date.now()}`;
  let q: BullMqQueue;
  const seen: { name: string; data: unknown }[] = [];
  const handlers: JobHandlers = {
    [JOBS.dispatch]: async (d) => void seen.push({ name: JOBS.dispatch, data: d }),
    [JOBS.sweep]: async () => void seen.push({ name: JOBS.sweep, data: {} }),
    [JOBS.reconcile]: async () => void seen.push({ name: JOBS.reconcile, data: {} }),
  };
  const until = async (f: () => boolean, ms = 8000) => {
    const end = Date.now() + ms;
    while (!f() && Date.now() < end) await new Promise((r) => setTimeout(r, 50));
  };

  beforeAll(async () => {
    q = new BullMqQueue(url!, prefix);
    q.register(handlers);
    await q.startWorkers([{ name: JOBS.sweep, everyMs: 200 }]);
  });
  afterAll(async () => {
    await q.close();
  });

  it('runs an added job in the worker with its data', async () => {
    await q.add(JOBS.dispatch, { outboxId: 'abc' });
    await until(() => seen.some((s) => s.name === JOBS.dispatch));
    expect(seen.find((s) => s.name === JOBS.dispatch)?.data).toEqual({ outboxId: 'abc' });
  });

  it('repeats a scheduled job on its own', async () => {
    await until(() => seen.filter((s) => s.name === JOBS.sweep).length >= 2);
    expect(seen.filter((s) => s.name === JOBS.sweep).length).toBeGreaterThanOrEqual(2);
  });
});

describe('BullMQ queue when Redis is unreachable', () => {
  it('gives up fast instead of hanging the request (the outbox sweep picks the event up later)', async () => {
    const q = new BullMqQueue('redis://127.0.0.1:1', `down-${Date.now()}`);
    const t0 = Date.now();
    await q.add(JOBS.dispatch, { outboxId: 'x' }); // must not throw nor hang
    expect(Date.now() - t0).toBeLessThan(3000);
    await q.close().catch(() => {});
  }, 10_000);
});
