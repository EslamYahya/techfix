import { Inject, Injectable } from '@nestjs/common';
import { DomainEvents } from '../events/domain-events.js';
import {
  ACTION_GUARDS,
  DomainError,
  allowedEvents,
  assertCanCreateQuote,
  authorize,
  computeQuote,
  quoteTransition,
  transition,
  type Actor,
} from '@techfix/domain';
import { z } from 'zod';
import type { AuditCtx } from '../catalog/catalog.service.js';
import { parse } from '../common/zod.js';
import {
  REPOS,
  type NewQuote,
  type QuoteRecord,
  type Repos,
  type RequestAggregate,
} from '../repos.js';
import { RequestsService, quoteDto, resourceOf } from '../requests/requests.service.js';

const QUOTE_TTL_MS = 48 * 3600_000;
const isUuid = (s: string) => z.uuid().safeParse(s).success;

// `.strict()`: a client that sends `total` (or anything we do not know) is rejected, never silently trusted.
const ItemSchema = z
  .object({
    type: z.enum(['LABOR', 'MATERIAL', 'OTHER']),
    description: z.string().trim().min(1).max(200),
    quantity: z.number().positive().max(10_000),
    unitPrice: z.number().min(0).max(1_000_000),
  })
  .strict();
const QuoteSchema = z
  .object({
    items: z.array(ItemSchema).min(1).max(30),
    estimatedDurationMinutes: z
      .number()
      .int()
      .positive()
      .max(60 * 24 * 30),
    notes: z.string().trim().max(1000).optional(),
  })
  .strict();
const ReasonSchema = z.object({ reason: z.string().trim().max(300).optional() }).default({});

@Injectable()
export class QuotesService {
  constructor(
    @Inject(REPOS) private readonly repos: Repos,
    @Inject(RequestsService) private readonly requests: RequestsService,
    @Inject(DomainEvents) private readonly events: DomainEvents,
  ) {}

  private build(
    agg: RequestAggregate,
    actor: Actor,
    body: unknown,
    kind: 'MAIN' | 'ADDITIONAL',
    parentQuoteId: string | null,
  ): NewQuote {
    const input = parse(QuoteSchema, body);
    const c = computeQuote({
      items: input.items,
      estimatedDurationMinutes: input.estimatedDurationMinutes,
      ...(input.notes ? { notes: input.notes } : {}),
    });
    return {
      requestId: agg.request.id,
      engineerId: actor.profileId!,
      kind,
      parentQuoteId,
      items: c.items,
      subtotal: c.subtotal,
      total: c.total,
      notes: input.notes ?? null,
      estimatedDurationMinutes: input.estimatedDurationMinutes,
      expiresAt: new Date(Date.now() + QUOTE_TTL_MS),
    };
  }

  async sendMain(actor: Actor, requestId: string, body: unknown, ctx: AuditCtx) {
    const agg = await this.requests.load(actor, requestId, ACTION_GUARDS['createQuote']!);
    const quotes = await this.repos.quotes.list(agg.request.id);
    assertCanCreateQuote('MAIN', agg.request.status, quotes);
    const to = transition(agg.request.status, 'SEND_QUOTE', 'ENGINEER');
    const q = await this.repos.quotes.sendMain(this.build(agg, actor, body, 'MAIN', null), {
      expectedVersion: agg.request.version,
      from: agg.request.status,
      to,
      event: { code: 'QUOTE_SENT', actorId: actor.id, actorRole: 'ENGINEER' },
    });
    if (!q) throw new DomainError('CONFLICT', 'Request changed, reload');
    await this.events.publish({
      type: 'QUOTE_SENT',
      requestId: agg.request.id,
      actorUserId: actor.id,
    });
    await this.audit(ctx, 'quote.send', q, { total: q.total });
    return { data: quoteDto(q) };
  }

  async list(actor: Actor, requestId: string) {
    const permission =
      actor.role === 'ADMIN' ? ('quotes.read' as const) : ('quotes.read.own' as const);
    const agg = await this.requests.load(actor, requestId, { permission });
    const quotes = await this.repos.quotes.list(agg.request.id);
    return { data: quotes.filter((q) => q.status !== 'DRAFT').map(quoteDto) };
  }

  async acceptMain(actor: Actor, quoteId: string, ctx: AuditCtx) {
    const { quote, agg } = await this.loadQuote(
      actor,
      quoteId,
      'MAIN',
      ACTION_GUARDS['acceptQuote']!,
    );
    this.assertLive(quote);
    quoteTransition(quote.status, 'ACCEPT');
    const to = transition(agg.request.status, 'ACCEPT_QUOTE', 'CUSTOMER');
    const job = await this.repos.quotes.acceptMain(quote.id, {
      expectedVersion: agg.request.version,
      from: agg.request.status,
      to,
      event: { code: 'QUOTE_ACCEPTED', actorId: actor.id, actorRole: 'CUSTOMER' },
    });
    if (!job) throw new DomainError('CONFLICT', 'Request changed, reload');
    await this.events.publish({
      type: 'QUOTE_ACCEPTED',
      requestId: agg.request.id,
      actorUserId: actor.id,
      jobId: job.id,
    });
    await this.audit(ctx, 'quote.accept', quote, { total: quote.total, jobId: job.id });
    return this.transitioned(agg, to, job.id);
  }

  async rejectMain(actor: Actor, quoteId: string, body: unknown, ctx: AuditCtx) {
    const { reason } = parse(ReasonSchema, body);
    const { quote, agg } = await this.loadQuote(
      actor,
      quoteId,
      'MAIN',
      ACTION_GUARDS['rejectQuote']!,
    );
    quoteTransition(quote.status, 'REJECT');
    const to = transition(agg.request.status, 'REJECT_QUOTE', 'CUSTOMER');
    const ok = await this.repos.quotes.rejectMain(quote.id, reason ?? null, {
      expectedVersion: agg.request.version,
      from: agg.request.status,
      to,
      event: { code: 'QUOTE_REJECTED', actorId: actor.id, actorRole: 'CUSTOMER' },
    });
    if (!ok) throw new DomainError('CONFLICT', 'Request changed, reload');
    await this.events.publish({
      type: 'QUOTE_REJECTED',
      requestId: agg.request.id,
      actorUserId: actor.id,
    });
    await this.audit(ctx, 'quote.reject', quote, { reason: reason ?? null });
    return this.transitioned(agg, to);
  }

  async sendAdditional(actor: Actor, jobId: string, body: unknown, ctx: AuditCtx) {
    authorize(actor, ACTION_GUARDS['createAdditionalQuote']!);
    const job = isUuid(jobId) ? await this.repos.jobs.get(jobId) : null;
    if (!job) throw new DomainError('NOT_FOUND');
    const agg = await this.requests.load(
      actor,
      job.requestId,
      ACTION_GUARDS['createAdditionalQuote']!,
    );
    const quotes = await this.repos.quotes.list(agg.request.id);
    assertCanCreateQuote('ADDITIONAL', agg.request.status, quotes);
    const q = await this.repos.quotes.sendAdditional(
      this.build(agg, actor, body, 'ADDITIONAL', job.quoteId),
      agg.request.version,
    );
    if (!q) throw new DomainError('CONFLICT', 'Request changed, reload');
    await this.events.publish({
      type: 'EXTRA_QUOTE_SENT',
      requestId: agg.request.id,
      actorUserId: actor.id,
      jobId: job.id,
    });
    await this.audit(ctx, 'quote.additional.send', q, { total: q.total });
    return { data: quoteDto(q) };
  }

  async decideAdditional(
    actor: Actor,
    quoteId: string,
    accept: boolean,
    body: unknown,
    ctx: AuditCtx,
  ) {
    const { reason } = parse(ReasonSchema, body);
    const guard = ACTION_GUARDS[accept ? 'acceptQuote' : 'rejectQuote']!;
    const { quote, agg } = await this.loadQuote(actor, quoteId, 'ADDITIONAL', guard);
    if (agg.request.status !== 'IN_PROGRESS')
      throw new DomainError('INVALID_STATE_TRANSITION', 'Extra work is decided while in progress');
    this.assertLive(quote);
    const status = quoteTransition(quote.status, accept ? 'ACCEPT' : 'REJECT');
    const ok = await this.repos.quotes.decideAdditional(
      quote.id,
      status as 'ACCEPTED' | 'REJECTED',
      accept ? null : (reason ?? null),
    );
    if (!ok) throw new DomainError('CONFLICT', 'Quote already decided');
    await this.events.publish({
      type: accept ? 'EXTRA_QUOTE_ACCEPTED' : 'EXTRA_QUOTE_REJECTED',
      requestId: agg.request.id,
      actorUserId: actor.id,
    });
    await this.audit(ctx, accept ? 'quote.additional.accept' : 'quote.additional.reject', quote, {
      total: quote.total,
    });
    return this.transitioned(agg, agg.request.status);
  }

  // — internals —

  private async loadQuote(
    actor: Actor,
    quoteId: string,
    kind: 'MAIN' | 'ADDITIONAL',
    guard: Parameters<RequestsService['load']>[2],
  ) {
    authorize(actor, guard);
    const quote = isUuid(quoteId) ? await this.repos.quotes.get(quoteId) : null;
    if (!quote || quote.kind !== kind) throw new DomainError('NOT_FOUND');
    const agg = await this.requests.load(actor, quote.requestId, guard);
    // A quote of an engineer who was replaced is no longer actionable.
    if (quote.engineerId !== agg.request.selectedEngineerId) throw new DomainError('NOT_FOUND');
    authorize(actor, guard, resourceOf(agg));
    return { quote, agg };
  }

  private assertLive(q: QuoteRecord) {
    if (q.status === 'SENT' && q.expiresAt && q.expiresAt.getTime() < Date.now())
      throw new DomainError('INVALID_STATE_TRANSITION', 'Quote expired');
  }

  private transitioned(
    agg: RequestAggregate,
    status: RequestAggregate['request']['status'],
    jobId?: string,
  ) {
    return {
      data: {
        requestId: agg.request.id,
        status,
        ...(jobId ? { jobId } : {}),
        availableActions: allowedEvents(status, 'CUSTOMER'),
      },
    };
  }

  private audit(ctx: AuditCtx, action: string, q: QuoteRecord, after: Record<string, unknown>) {
    return this.repos.audit.record({
      ...ctx,
      action,
      entityType: 'Quote',
      entityId: q.id,
      after: { requestId: q.requestId, kind: q.kind, ...after },
    });
  }
}
