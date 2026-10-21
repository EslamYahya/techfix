import { Inject, Injectable } from '@nestjs/common';
import {
  ACTION_GUARDS,
  DomainError,
  assertCanRefund,
  authorize,
  transition,
  type Actor,
  type PaymentMethod,
  type PaymentStatus,
  type RequestStatus,
} from '@techfix/domain';
import { z } from 'zod';
import type { AuditCtx } from '../catalog/catalog.service.js';
import { clampLimit, decodeCursor, encodeCursor } from '../common/pagination.js';
import { parse } from '../common/zod.js';
import { DomainEvents } from '../events/domain-events.js';
import {
  REPOS,
  type AdminPage,
  type AdminPaymentRow,
  type AdminReviewRow,
  type DisputeRow,
  type DisputeStatusName,
  type Repos,
} from '../repos.js';
import { RequestsService, numberOf } from '../requests/requests.service.js';

const isUuid = (s: string) => z.uuid().safeParse(s).success;

const ReasonRequired = z.object({ reason: z.string().trim().min(3).max(500) }).strict();
const RefundSchema = z
  .object({
    amount: z.number().positive().max(1_000_000),
    reason: z.string().trim().min(3).max(500),
  })
  .strict();
const ResolveSchema = z
  .object({
    /** CONFIRM_COMPLETION: the work is accepted and the request moves on (admin confirms for the customer). */
    outcome: z.enum(['CONFIRM_COMPLETION', 'CLOSE', 'REJECT']),
    resolution: z.string().trim().min(5).max(1000),
  })
  .strict();
const HideSchema = z.object({ hidden: z.boolean() }).strict();

const STATUSES: readonly string[] = ['PENDING', 'PAID', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED'];
const DISPUTE_STATUSES: readonly string[] = ['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED'];

const bad = (field: string): never => {
  throw new DomainError('VALIDATION_ERROR', 'Invalid filter', [{ field, code: 'invalid_value' }]);
};

const paymentDto = (p: AdminPaymentRow) => ({
  id: p.id,
  jobId: p.jobId,
  requestId: p.requestId,
  requestNumber: numberOf(p.requestNumber),
  method: p.method,
  status: p.status,
  amount: p.amount,
  refunded: p.refunded,
  reference: p.providerRef,
  customerName: p.customerName,
  engineerName: p.engineerName,
  createdAt: p.createdAt.toISOString(),
  paidAt: p.paidAt?.toISOString() ?? null,
});
const disputeDto = (d: DisputeRow) => ({
  id: d.id,
  requestId: d.requestId,
  requestNumber: numberOf(d.requestNumber),
  openedByName: d.openedByName,
  openedByRole: d.openedByRole,
  reason: d.reason,
  description: d.description,
  status: d.status,
  resolution: d.resolution,
  createdAt: d.createdAt.toISOString(),
  resolvedAt: d.resolvedAt?.toISOString() ?? null,
});
const reviewDto = (r: AdminReviewRow) => ({
  id: r.id,
  requestNumber: numberOf(r.requestNumber),
  rating: r.rating,
  comment: r.comment,
  hidden: r.isHidden,
  customerName: r.customerName,
  engineerName: r.engineerName,
  createdAt: r.createdAt.toISOString(),
});

const meta = <T extends { createdAt: Date; id: string }>(p: AdminPage<T>) => ({
  nextCursor: p.next ? encodeCursor(p.next) : null,
});

/** Back office: reading everything, and the few actions an operator may take. Every action is audited. */
@Injectable()
export class AdminService {
  constructor(
    @Inject(REPOS) private readonly repos: Repos,
    @Inject(RequestsService) private readonly requests: RequestsService,
    @Inject(DomainEvents) private readonly events: DomainEvents,
  ) {}

  private page(q: { limit?: string; cursor?: string }) {
    const cursor = decodeCursor(q.cursor);
    return { limit: clampLimit(q.limit), ...(cursor ? { cursor } : {}) };
  }

  // ---- requests -------------------------------------------------------------------------

  async listRequests(
    actor: Actor,
    q: { status?: string; hasDispute?: string; limit?: string; cursor?: string },
  ) {
    authorize(actor, ACTION_GUARDS['adminRead']!);
    const { REQUEST_STATUSES } = await import('@techfix/domain');
    if (q.status && !(REQUEST_STATUSES as readonly string[]).includes(q.status)) bad('status');
    const page = await this.repos.admin.listRequests({
      ...this.page(q),
      ...(q.status ? { status: q.status as RequestStatus } : {}),
      ...(q.hasDispute === 'true' ? { hasDispute: true } : {}),
    });
    return {
      data: page.items.map((r) => ({
        id: r.id,
        number: numberOf(r.number),
        status: r.status,
        serviceName: r.serviceName,
        customerName: r.customerName,
        engineerName: r.engineerName,
        hasDispute: r.hasDispute,
        createdAt: r.createdAt.toISOString(),
      })),
      meta: meta(page),
    };
  }

  async cancelRequest(actor: Actor, id: string, body: unknown, ctx: AuditCtx) {
    const { reason } = parse(ReasonRequired, body);
    const agg = await this.requests.load(actor, id, ACTION_GUARDS['adminCancel']!);
    const to = transition(agg.request.status, 'CANCEL', 'ADMIN');
    const ok = await this.repos.requests.apply(agg.request.id, {
      expectedVersion: agg.request.version,
      from: agg.request.status,
      to,
      selectedEngineerId: null,
      cancel: { reason, by: 'ADMIN' },
      cancelOpenQuotes: true,
      event: { code: 'REQUEST_CANCELLED_BY_ADMIN', actorId: actor.id, actorRole: 'ADMIN' },
    });
    if (!ok) throw new DomainError('CONFLICT', 'Request changed, reload');
    await this.events.publish({
      type: 'REQUEST_CANCELLED_BY_ADMIN',
      requestId: agg.request.id,
      actorUserId: actor.id,
      engineerId: agg.request.selectedEngineerId,
    });
    await this.repos.audit.record({
      ...ctx,
      action: 'request.admin_cancel',
      entityType: 'ServiceRequest',
      entityId: agg.request.id,
      before: { status: agg.request.status },
      after: { status: to, reason },
    });
    return { data: { requestId: agg.request.id, status: to, availableActions: [] } };
  }

  // ---- money ----------------------------------------------------------------------------

  async listPayments(
    actor: Actor,
    q: { status?: string; method?: string; limit?: string; cursor?: string },
  ) {
    authorize(actor, ACTION_GUARDS['listPayments']!);
    if (q.status && !STATUSES.includes(q.status)) bad('status');
    if (q.method && q.method !== 'CASH' && q.method !== 'ONLINE') bad('method');
    const [page, totals] = await Promise.all([
      this.repos.admin.listPayments({
        ...this.page(q),
        ...(q.status ? { status: q.status as PaymentStatus } : {}),
        ...(q.method ? { method: q.method as PaymentMethod } : {}),
      }),
      this.repos.admin.paymentTotals(),
    ]);
    return { data: page.items.map(paymentDto), meta: { ...meta(page), totals } };
  }

  /** Records money handed back to the customer. The money itself moves outside the platform (see ADR 0008). */
  async refund(actor: Actor, paymentId: string, body: unknown, ctx: AuditCtx) {
    authorize(actor, ACTION_GUARDS['refundPayment']!);
    const v = parse(RefundSchema, body);
    const p = isUuid(paymentId) ? await this.repos.payments.get(paymentId) : null;
    if (!p) throw new DomainError('NOT_FOUND');
    assertCanRefund(p, v.amount);
    const r = await this.repos.admin.refund(p.id, { ...v, adminId: actor.id });
    if (!r.ok) throw new DomainError('CONFLICT', 'Payment changed, reload');
    const job = await this.repos.jobs.get(p.jobId);
    if (job)
      await this.events.publish({
        type: 'PAYMENT_REFUNDED',
        requestId: job.requestId,
        actorUserId: actor.id,
        jobId: job.id,
      });
    await this.repos.audit.record({
      ...ctx,
      action: 'payment.refund',
      entityType: 'Payment',
      entityId: p.id,
      before: { status: p.status, refunded: p.refunded },
      after: {
        status: r.payment.status,
        refunded: r.payment.refunded,
        amount: v.amount,
        reason: v.reason,
      },
    });
    return {
      data: {
        id: r.payment.id,
        status: r.payment.status,
        amount: r.payment.amount,
        refunded: r.payment.refunded,
      },
    };
  }

  // ---- disputes -------------------------------------------------------------------------

  async listDisputes(actor: Actor, q: { status?: string; limit?: string; cursor?: string }) {
    authorize(actor, ACTION_GUARDS['listDisputes']!);
    if (q.status && !DISPUTE_STATUSES.includes(q.status)) bad('status');
    const page = await this.repos.admin.listDisputes({
      ...this.page(q),
      ...(q.status ? { status: q.status as DisputeStatusName } : {}),
    });
    return { data: page.items.map(disputeDto), meta: meta(page) };
  }

  async resolveDispute(actor: Actor, id: string, body: unknown, ctx: AuditCtx) {
    authorize(actor, ACTION_GUARDS['resolveDispute']!);
    const v = parse(ResolveSchema, body);
    const d = isUuid(id) ? await this.repos.admin.getDispute(id) : null;
    if (!d) throw new DomainError('NOT_FOUND');
    if (d.status === 'RESOLVED' || d.status === 'REJECTED')
      throw new DomainError('INVALID_STATE_TRANSITION', 'Dispute already closed');

    if (v.outcome === 'CONFIRM_COMPLETION') {
      // The state machine guards this edge, so a second attempt cannot apply it twice.
      const agg = await this.repos.requests.get(d.requestId);
      if (!agg) throw new DomainError('NOT_FOUND');
      const to = transition(agg.request.status, 'CONFIRM_COMPLETION', 'ADMIN');
      const ok = await this.repos.requests.apply(agg.request.id, {
        expectedVersion: agg.request.version,
        from: agg.request.status,
        to,
        jobStamp: 'confirmedByCustomerAt',
        event: { code: 'COMPLETION_CONFIRMED', actorId: actor.id, actorRole: 'ADMIN' },
      });
      if (!ok) throw new DomainError('CONFLICT', 'Request changed, reload');
    }
    const closed = await this.repos.admin.resolveDispute(d.id, {
      status: v.outcome === 'REJECT' ? 'REJECTED' : 'RESOLVED',
      resolution: v.resolution,
      adminId: actor.id,
    });
    if (!closed) throw new DomainError('CONFLICT', 'Dispute already closed');
    await this.events.publish({
      type: 'DISPUTE_RESOLVED',
      requestId: d.requestId,
      actorUserId: actor.id,
      jobId: d.jobId,
    });
    await this.repos.audit.record({
      ...ctx,
      action: 'dispute.resolve',
      entityType: 'Dispute',
      entityId: d.id,
      after: { outcome: v.outcome, resolution: v.resolution },
    });
    return {
      data: disputeDto((await this.repos.admin.getDispute(d.id))!),
    };
  }

  // ---- reviews --------------------------------------------------------------------------

  async listReviews(actor: Actor, q: { hidden?: string; limit?: string; cursor?: string }) {
    authorize(actor, ACTION_GUARDS['listReviews']!);
    if (q.hidden && q.hidden !== 'true' && q.hidden !== 'false') bad('hidden');
    const page = await this.repos.admin.listReviews({
      ...this.page(q),
      ...(q.hidden ? { hidden: q.hidden === 'true' } : {}),
    });
    return { data: page.items.map(reviewDto), meta: meta(page) };
  }

  async hideReview(actor: Actor, id: string, body: unknown, ctx: AuditCtx) {
    authorize(actor, ACTION_GUARDS['hideReview']!);
    const { hidden } = parse(HideSchema, body);
    const before = isUuid(id) ? await this.repos.admin.getReview(id) : null;
    if (!before) throw new DomainError('NOT_FOUND');
    const after = (await this.repos.admin.setReviewHidden(id, hidden))!;
    await this.repos.audit.record({
      ...ctx,
      action: hidden ? 'review.hide' : 'review.unhide',
      entityType: 'Review',
      entityId: id,
      before: { hidden: before.isHidden },
      after: { hidden: after.isHidden },
    });
    return { data: reviewDto(after) };
  }
}
