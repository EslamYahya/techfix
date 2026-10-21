import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';
import { ENV, type Env } from '../config/env.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PaymentsService } from '../payments/payments.service.js';
import { JOB_QUEUE, JOBS, type JobQueue } from '../queue/queue.js';

/**
 * Connects the queue to the application: which function runs for which job, and which jobs repeat.
 * Handlers are always registered (the inline queue needs them to deliver at once); the repeating
 * schedule starts only when RUN_WORKERS is on, so API-only replicas stay light.
 */
@Injectable()
export class WorkersService implements OnModuleInit, OnApplicationShutdown {
  private readonly log = new Logger('Workers');
  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(JOB_QUEUE) private readonly queue: JobQueue,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
    @Inject(PaymentsService) private readonly payments: PaymentsService,
  ) {}

  async onModuleInit() {
    this.queue.register({
      [JOBS.dispatch]: async (d) => {
        if (typeof d['outboxId'] === 'string') await this.notifications.deliverById(d['outboxId']);
      },
      [JOBS.sweep]: async () => {
        const r = await this.notifications.sweep();
        if (r.leased) this.log.log(`outbox sweep: ${r.delivered}/${r.leased} delivered`);
      },
      [JOBS.reconcile]: async () => {
        await this.payments.reconcilePending();
      },
    });
    if (!this.env.RUN_WORKERS) return;
    const reconcile =
      this.env.FAWRY_MERCHANT_CODE !== undefined
        ? [{ name: JOBS.reconcile, everyMs: this.env.PAYMENT_RECONCILE_INTERVAL_MINUTES * 60_000 }]
        : []; // nothing online to reconcile without a provider
    await this.queue.startWorkers([
      { name: JOBS.sweep, everyMs: this.env.OUTBOX_SWEEP_INTERVAL_SECONDS * 1000 },
      ...reconcile,
    ]);
    this.log.log(`workers started (${this.queue.driver})`);
  }

  async onApplicationShutdown() {
    await this.queue.close();
  }
}
