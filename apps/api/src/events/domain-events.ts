import { Inject, Injectable, Logger } from '@nestjs/common';
import { REPOS, type Repos } from '../repos.js';
import { JOB_QUEUE, JOBS, type JobQueue } from '../queue/queue.js';

/** What happened, in the language of the product. People to notify are worked out later, by the worker. */
export interface DomainEvent {
  type: string;
  requestId: string;
  /** Who did it — never notified about their own action. */
  actorUserId?: string | null;
  /** Engineer profile to notify, when it can no longer be read from the request (engineer was just released). */
  engineerId?: string | null;
  jobId?: string | null;
}

/**
 * Transactional-outbox style publisher: the event is stored first, then a delivery job is queued.
 * A failure here is logged and never surfaces to the person who did the action — the stored row is
 * picked up by the periodic sweep.
 */
@Injectable()
export class DomainEvents {
  private readonly log = new Logger('DomainEvents');
  constructor(
    @Inject(REPOS) private readonly repos: Repos,
    @Inject(JOB_QUEUE) private readonly queue: JobQueue,
  ) {}

  async publish(ev: DomainEvent): Promise<void> {
    try {
      const id = await this.repos.outbox.enqueue(ev.type, { ...ev });
      await this.queue.add(JOBS.dispatch, { outboxId: id });
    } catch (e) {
      this.log.error(`could not publish ${ev.type}: ${(e as Error).message}`);
    }
  }
}
