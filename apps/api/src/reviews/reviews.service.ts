import { Inject, Injectable } from '@nestjs/common';
import { DomainEvents } from '../events/domain-events.js';
import {
  ACTION_GUARDS,
  DomainError,
  RATING_MAX,
  RATING_MIN,
  agreedTotal,
  authorize,
  canRate,
  transition,
  type Actor,
} from '@techfix/domain';
import { z } from 'zod';
import type { AuditCtx } from '../catalog/catalog.service.js';
import { clampLimit, decodeCursor, encodeCursor } from '../common/pagination.js';
import { parse } from '../common/zod.js';
import { summaryOf } from '../payments/payment.dto.js';
import { REPOS, type Repos, type ReviewRecord } from '../repos.js';
import { RequestsService } from '../requests/requests.service.js';

const isUuid = (s: string) => z.uuid().safeParse(s).success;
const ReviewSchema = z
  .object({
    rating: z.number().int().min(RATING_MIN).max(RATING_MAX),
    comment: z.string().trim().max(1000).optional(),
  })
  .strict();

/** Public shape: first name only, never a phone or a full name. */
const reviewDto = (r: ReviewRecord) => ({
  id: r.id,
  rating: r.rating,
  comment: r.comment,
  customerName: r.customerName.split(' ')[0] ?? '',
  createdAt: r.createdAt.toISOString(),
});

@Injectable()
export class ReviewsService {
  constructor(
    @Inject(REPOS) private readonly repos: Repos,
    @Inject(RequestsService) private readonly requests: RequestsService,
    @Inject(DomainEvents) private readonly events: DomainEvents,
  ) {}

  /** Customer rates the engineer once, after the job is completed AND fully paid. Request → RATED. */
  async create(actor: Actor, jobId: string, body: unknown, ctx: AuditCtx) {
    const v = parse(ReviewSchema, body);
    const guard = ACTION_GUARDS['createReview']!;
    authorize(actor, guard);
    const job = isUuid(jobId) ? await this.repos.jobs.get(jobId) : null;
    if (!job) throw new DomainError('NOT_FOUND');
    const agg = await this.requests.load(actor, job.requestId, guard);
    const [quotes, payments] = await Promise.all([
      this.repos.quotes.list(agg.request.id),
      this.repos.payments.listForJob(job.id),
    ]);
    if (!canRate(agg.request.status, summaryOf(agreedTotal(quotes), payments).state))
      throw new DomainError('PAYMENT_NOT_VERIFIED', 'Rating opens after full payment');
    const to = transition(agg.request.status, 'RATE', 'CUSTOMER');
    const rec = await this.repos.reviews.create(
      {
        jobId: job.id,
        customerId: job.customerId,
        engineerId: job.engineerId,
        rating: v.rating,
        comment: v.comment ?? null,
      },
      {
        expectedVersion: agg.request.version,
        from: agg.request.status,
        to,
        event: { code: 'REVIEWED', actorId: actor.id, actorRole: 'CUSTOMER' },
      },
    );
    if (!rec) throw new DomainError('CONFLICT', 'Request changed, reload');
    await this.events.publish({
      type: 'REVIEWED',
      requestId: agg.request.id,
      actorUserId: actor.id,
      jobId: job.id,
    });
    await this.repos.audit.record({
      ...ctx,
      action: 'review.create',
      entityType: 'Review',
      entityId: rec.id,
      after: { jobId: job.id, rating: rec.rating },
    });
    return { data: { ...reviewDto(rec), requestId: agg.request.id, status: to } };
  }

  async listForEngineer(actor: Actor, engineerId: string, q: { limit?: string; cursor?: string }) {
    if (actor.role === 'ENGINEER') {
      authorize(actor, { permission: 'reviews.read.own' });
      if (actor.profileId !== engineerId) throw new DomainError('FORBIDDEN');
    } else
      authorize(actor, { permission: actor.role === 'ADMIN' ? 'reviews.read' : 'engineers.read' });
    if (!isUuid(engineerId) || !(await this.repos.engineers.get(engineerId)))
      throw new DomainError('NOT_FOUND');
    const cursor = decodeCursor(q.cursor);
    const { items, next } = await this.repos.reviews.listForEngineer(engineerId, {
      limit: clampLimit(q.limit),
      ...(cursor ? { cursor } : {}),
    });
    return {
      data: items.map(reviewDto),
      meta: { nextCursor: next ? encodeCursor(next) : null },
    };
  }
}
