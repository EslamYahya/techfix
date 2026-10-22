import { Inject, Injectable } from '@nestjs/common';
import { DomainEvents } from '../events/domain-events.js';
import {
  ACTION_GUARDS,
  DEFAULT_WEIGHTS,
  DomainError,
  agreedTotal,
  allowedEvents,
  assertStillEligible,
  authorize,
  isInSupportedArea,
  recommend,
  redactEngineerForCustomer,
  redactForEngineer,
  toPublicRecommendation,
  transition,
  REQUEST_STATUSES,
  type Actor,
  type Guard,
  type RequestEvent,
} from '@techfix/domain';
import { z } from 'zod';
import type { AuditCtx } from '../catalog/catalog.service.js';
import { clampLimit, decodeCursor, encodeCursor } from '../common/pagination.js';
import { parse } from '../common/zod.js';
import {
  REPOS,
  type JobRecord,
  type MatchRow,
  type QuoteRecord,
  type RequestAggregate,
  type Repos,
} from '../repos.js';
import { paymentActions, paymentView } from '../payments/payment.dto.js';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const CreateSchema = z
  .object({
    serviceId: z.uuid(),
    subService: z.string().trim().max(80).optional(),
    description: z.string().trim().min(10).max(2000),
    preferredDate: z.iso.date(),
    preferredSlot: z.enum(['MORNING', 'NOON', 'EVENING']).optional(),
    preferredStartTime: z.string().regex(HHMM).optional(),
    preferredEndTime: z.string().regex(HHMM).optional(),
    location: z.object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      address: z.string().trim().min(3).max(300).optional(),
      area: z.string().trim().min(2).max(80).optional(),
    }),
    attachmentKeys: z
      .array(
        z
          .string()
          .min(3)
          .max(200)
          .regex(/^[A-Za-z0-9][A-Za-z0-9/_.-]*$/)
          .refine((k) => !k.includes('..')),
      )
      .max(8)
      .default([]),
  })
  .refine((v) => !!(v.location.address ?? v.location.area), {
    path: ['location', 'address'],
    message: 'required',
  })
  .refine(
    (v) =>
      !v.preferredStartTime || !v.preferredEndTime || v.preferredStartTime < v.preferredEndTime,
    { path: ['preferredEndTime'], message: 'order' },
  );
const SelectSchema = z.object({ engineerId: z.uuid() });
const ReasonSchema = z.object({ reason: z.string().trim().max(300).optional() }).default({});
const StatusQuery = z.enum(REQUEST_STATUSES);

const cairoToday = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date());
const isUuid = (s: string) => z.uuid().safeParse(s).success;
/** Stable public reference used in customer communications and support. */
export const numberOf = (n: number) => `R-${n}`;

type Role = Actor['role'];
export const resourceOf = (a: RequestAggregate) => ({
  customerId: a.request.customerId,
  selectedEngineerId: a.request.selectedEngineerId,
  status: a.request.status,
});
const actionsFor = (a: RequestAggregate, role: Role): RequestEvent[] =>
  role === 'ADMIN' ? [] : allowedEvents(a.request.status, role);

export const quoteDto = (q: QuoteRecord) => ({
  id: q.id,
  kind: q.kind,
  status: q.status,
  items: q.items,
  subtotal: q.subtotal,
  total: q.total,
  estimatedDurationMinutes: q.estimatedDurationMinutes,
  notes: q.notes,
  rejectionReason: q.rejectionReason,
  expiresAt: q.expiresAt?.toISOString() ?? null,
  sentAt: q.sentAt?.toISOString() ?? null,
});

const jobDto = (j: JobRecord, quotes: QuoteRecord[]) => ({
  id: j.id,
  status: j.status,
  agreedTotal: agreedTotal(quotes),
  confirmedAt: j.confirmedAt?.toISOString() ?? null,
  startedTripAt: j.startedTripAt?.toISOString() ?? null,
  arrivedAt: j.arrivedAt?.toISOString() ?? null,
  startedAt: j.startedAt?.toISOString() ?? null,
  completedAt: j.completedAt?.toISOString() ?? null,
  confirmedByCustomerAt: j.confirmedByCustomerAt?.toISOString() ?? null,
});

/** Extra-work actions are not state-machine edges (the request stays IN_PROGRESS), so they are derived here. */
const additionalActions = (a: RequestAggregate, role: Role, quotes: QuoteRecord[]): string[] => {
  if (a.request.status !== 'IN_PROGRESS') return [];
  const pending = quotes.some((q) => q.kind === 'ADDITIONAL' && q.status === 'SENT');
  if (role === 'ENGINEER') return pending ? [] : ['SEND_ADDITIONAL_QUOTE'];
  if (role === 'CUSTOMER')
    return pending ? ['ACCEPT_ADDITIONAL_QUOTE', 'REJECT_ADDITIONAL_QUOTE'] : [];
  return [];
};

@Injectable()
export class RequestsService {
  constructor(
    @Inject(REPOS) private readonly repos: Repos,
    @Inject(DomainEvents) private readonly events: DomainEvents,
  ) {}

  async create(actor: Actor, body: unknown, ctx: AuditCtx) {
    authorize(actor, ACTION_GUARDS['createRequest']!);
    const v = parse(CreateSchema, body);
    if (!isInSupportedArea(v.location.latitude, v.location.longitude))
      throw new DomainError('VALIDATION_ERROR', 'Outside supported area', [
        { field: 'location', code: 'out_of_area' },
      ]);
    if (v.preferredDate < cairoToday())
      throw new DomainError('VALIDATION_ERROR', 'Date in the past', [
        { field: 'preferredDate', code: 'too_small' },
      ]);
    const service = await this.repos.catalog.getService(v.serviceId);
    if (!service || !service.isActive)
      throw new DomainError('VALIDATION_ERROR', 'Unknown service', [
        { field: 'serviceId', code: 'invalid_value' },
      ]);
    const rec = await this.repos.requests.create({
      customerId: actor.profileId!,
      serviceId: v.serviceId,
      subService: v.subService ?? null,
      description: v.description,
      preferredDate: v.preferredDate,
      preferredSlot: v.preferredSlot ?? null,
      preferredStartTime: v.preferredStartTime ?? null,
      preferredEndTime: v.preferredEndTime ?? null,
      location: {
        latitude: v.location.latitude,
        longitude: v.location.longitude,
        address: (v.location.address ?? v.location.area)!,
        city: null,
        area: v.location.area ?? null,
      },
      attachmentKeys: v.attachmentKeys,
    });
    await this.repos.audit.record({
      ...ctx,
      action: 'request.create',
      entityType: 'ServiceRequest',
      entityId: rec.id,
      after: { status: rec.status, serviceId: rec.serviceId },
    });
    return { data: { id: rec.id, number: numberOf(rec.number), status: rec.status } };
  }

  async listMine(actor: Actor, q: { status?: string; limit?: string; cursor?: string }) {
    authorize(actor, { permission: 'requests.read.own' });
    return this.list(actor, q, (query) =>
      this.repos.requests.listForCustomer(actor.profileId!, query),
    );
  }

  async listAssigned(actor: Actor, q: { status?: string; limit?: string; cursor?: string }) {
    authorize(actor, { permission: 'requests.read.assigned' });
    return this.list(actor, q, (query) =>
      this.repos.requests.listForEngineer(actor.profileId!, query),
    );
  }

  private async list(
    actor: Actor,
    q: { status?: string; limit?: string; cursor?: string },
    fetch: (query: {
      status?: (typeof REQUEST_STATUSES)[number];
      limit: number;
      cursor?: { t: string; id: string };
    }) => Promise<{ items: RequestAggregate[]; next: { t: string; id: string } | null }>,
  ) {
    const status = q.status ? parse(StatusQuery, q.status) : undefined;
    const { items, next } = await fetch({
      ...(status ? { status } : {}),
      limit: clampLimit(q.limit),
      ...(decodeCursor(q.cursor) ? { cursor: decodeCursor(q.cursor)! } : {}),
    });
    return {
      data: items.map((a) => this.summary(a, actor.role)),
      meta: { nextCursor: next ? encodeCursor(next) : null },
    };
  }

  private summary(a: RequestAggregate, role: Role) {
    const r = a.request;
    return {
      id: r.id,
      number: numberOf(r.number),
      status: r.status,
      service: { id: a.service.id, name: a.service.name, category: a.service.category.name },
      description: r.description,
      preferredDate: r.preferredDate,
      preferredSlot: r.preferredSlot,
      area: r.location.area ?? '',
      createdAt: r.createdAt.toISOString(),
      ...(role === 'CUSTOMER'
        ? { engineer: a.engineer ? { name: a.engineer.name } : null }
        : { customerName: a.customer.name.split(' ')[0] ?? '' }),
    };
  }

  async detail(actor: Actor, id: string) {
    const permission =
      actor.role === 'CUSTOMER'
        ? 'requests.read.own'
        : actor.role === 'ENGINEER'
          ? 'requests.read.assigned'
          : 'requests.read';
    const agg = await this.load(actor, id, { permission });
    return { data: await this.fullDetail(agg, actor.role) };
  }

  /** Request details with quotes, the job and the money summary — what both the request and job screens read. */
  async fullDetail(agg: RequestAggregate, role: Role) {
    const [quotes, job] = await Promise.all([
      this.repos.quotes.list(agg.request.id),
      this.repos.jobs.getByRequest(agg.request.id),
    ]);
    const [payments, review] = job
      ? await Promise.all([
          this.repos.payments.listForJob(job.id),
          this.repos.reviews.getByJob(job.id),
        ])
      : [[], null];
    const money = job ? paymentView(agreedTotal(quotes), payments) : null;
    const payActions = money
      ? paymentActions({ role, status: agg.request.status, view: money, reviewed: !!review })
      : [];
    // Drafts are never shown to the customer; everything else is part of the history.
    const visible = role === 'CUSTOMER' ? quotes.filter((q) => q.status !== 'DRAFT') : quotes;
    const dto = this.detailDto(agg, role);
    return {
      ...dto,
      quotes: visible.map(quoteDto),
      job: job ? jobDto(job, quotes) : null,
      payment: money,
      review: review ? { rating: review.rating, comment: review.comment } : null,
      availableActions: [
        // Booking is confirmed by choosing how to pay and rating needs full payment: both are derived below.
        ...dto.availableActions.filter((a) => a !== 'CONFIRM_BOOKING' && a !== 'RATE'),
        ...additionalActions(agg, role, quotes),
        ...payActions,
      ],
    };
  }

  private detailDto(a: RequestAggregate, role: Role) {
    const r = a.request;
    const full = {
      name: a.customer.name,
      phone: a.customer.phone,
      address: r.location.address,
      area: r.location.area ?? '',
      latitude: r.location.latitude,
      longitude: r.location.longitude,
    };
    const base = {
      id: r.id,
      number: numberOf(r.number),
      status: r.status,
      service: { id: a.service.id, name: a.service.name, category: a.service.category.name },
      subService: r.subService,
      description: r.description,
      preferredDate: r.preferredDate,
      preferredSlot: r.preferredSlot,
      preferredStartTime: r.preferredStartTime,
      preferredEndTime: r.preferredEndTime,
      attachmentKeys: r.attachmentKeys,
      cancelReason: r.cancelReason,
      createdAt: r.createdAt.toISOString(),
      quotes: [] as unknown[],
      job: null,
      payment: null,
      review: null,
      timeline: a.events.map((e) => ({
        at: e.at.toISOString(),
        status: e.toState,
        code: e.code,
        actorRole: e.actorRole,
      })),
      availableActions: actionsFor(a, role),
    };
    if (role === 'ENGINEER') {
      const red = redactForEngineer(r.status, full);
      const { customerName, customerPhone, ...loc } = red;
      return {
        ...base,
        location: loc,
        customer: { name: customerName, ...(customerPhone ? { phone: customerPhone } : {}) },
        engineer: null,
      };
    }
    const engineer = a.engineer
      ? {
          id: a.engineer.id,
          ...redactEngineerForCustomer(r.status, {
            name: a.engineer.name,
            phone: a.engineer.phone,
            area: a.engineer.area ?? '',
          }),
        }
      : null;
    return {
      ...base,
      location: {
        area: full.area,
        address: full.address,
        latitude: full.latitude,
        longitude: full.longitude,
      },
      customer: role === 'ADMIN' ? { name: full.name, phone: full.phone } : { name: full.name },
      engineer,
    };
  }

  async recommendations(actor: Actor, id: string) {
    const agg = await this.load(actor, id, ACTION_GUARDS['selectEngineer']!);
    const rows = await this.candidates(agg);
    const ranked = recommend(rows.candidates, rows.match, DEFAULT_WEIGHTS, 10);
    const byId = new Map(rows.candidates.map((c) => [c.engineerId, c]));
    return {
      data: ranked.map((rec) => {
        const c = byId.get(rec.engineerId)!;
        const pub = toPublicRecommendation(rec);
        return {
          engineerId: pub.engineerId,
          name: c.name,
          area: c.area ?? '',
          rating: c.ratingAverage,
          ratingCount: c.ratingCount,
          completedJobs: c.completedJobs,
          distanceKm: pub.distanceKm,
          etaMinutes: pub.etaMinutes,
          availability: c.availability,
          reasons: pub.reasons,
        };
      }),
    };
  }

  async selectEngineer(actor: Actor, id: string, body: unknown, ctx: AuditCtx) {
    const { engineerId } = parse(SelectSchema, body);
    const agg = await this.load(actor, id, ACTION_GUARDS['selectEngineer']!);
    const to = transition(agg.request.status, 'SELECT_ENGINEER', 'CUSTOMER');
    const { candidates, match } = await this.candidates(agg);
    assertStillEligible(
      candidates.find((c) => c.engineerId === engineerId),
      match,
    );
    return this.apply(agg, actor, ctx, {
      to,
      selectedEngineerId: engineerId,
      code: 'ENGINEER_SELECTED',
      role: 'CUSTOMER',
    });
  }

  async changeEngineer(actor: Actor, id: string, ctx: AuditCtx) {
    const agg = await this.load(actor, id, ACTION_GUARDS['changeEngineer']!);
    const to = transition(agg.request.status, 'CHANGE_ENGINEER', 'CUSTOMER');
    return this.apply(agg, actor, ctx, {
      to,
      selectedEngineerId: null,
      code: 'ENGINEER_CHANGED',
      role: 'CUSTOMER',
      cancelOpenQuotes: true,
      exclude: agg.request.selectedEngineerId
        ? { engineerId: agg.request.selectedEngineerId, reason: 'CHANGED_BY_CUSTOMER' }
        : undefined,
    });
  }

  async accept(actor: Actor, id: string, ctx: AuditCtx) {
    const agg = await this.load(actor, id, ACTION_GUARDS['engineerAccept']!);
    const to = transition(agg.request.status, 'ENGINEER_ACCEPT', 'ENGINEER');
    return this.apply(agg, actor, ctx, { to, code: 'ENGINEER_ACCEPTED', role: 'ENGINEER' });
  }

  async reject(actor: Actor, id: string, body: unknown, ctx: AuditCtx) {
    const { reason } = parse(ReasonSchema, body);
    const agg = await this.load(actor, id, ACTION_GUARDS['engineerReject']!);
    const to = transition(agg.request.status, 'ENGINEER_REJECT', 'ENGINEER');
    return this.apply(agg, actor, ctx, {
      to,
      selectedEngineerId: null,
      code: 'ENGINEER_REJECTED',
      role: 'ENGINEER',
      exclude: { engineerId: actor.profileId!, reason: reason ?? null },
    });
  }

  async cancel(actor: Actor, id: string, body: unknown, ctx: AuditCtx) {
    const { reason } = parse(ReasonSchema, body);
    const agg = await this.load(actor, id, ACTION_GUARDS['cancelRequest']!);
    const to = transition(agg.request.status, 'CANCEL', 'CUSTOMER');
    return this.apply(agg, actor, ctx, {
      to,
      selectedEngineerId: null,
      code: 'REQUEST_CANCELLED',
      role: 'CUSTOMER',
      cancelOpenQuotes: true,
      cancel: { reason: reason ?? null, by: 'CUSTOMER' },
    });
  }

  // — internals —

  /** Permission → exists → ownership (404 for non-owners) → state. */
  async load(actor: Actor, id: string, guard: Guard): Promise<RequestAggregate> {
    authorize(actor, guard);
    const agg = isUuid(id) ? await this.repos.requests.get(id) : null;
    if (!agg) throw new DomainError('NOT_FOUND');
    authorize(actor, guard, resourceOf(agg));
    return agg;
  }

  private async candidates(agg: RequestAggregate) {
    const r = agg.request;
    const [rows, excluded] = await Promise.all([
      this.repos.requests.matchCandidates({
        serviceId: r.serviceId,
        latitude: r.location.latitude,
        longitude: r.location.longitude,
      }),
      this.repos.requests.excludedEngineers(r.id),
    ]);
    return {
      candidates: rows as MatchRow[],
      match: { serviceId: r.serviceId, subService: r.subService, excludedEngineerIds: excluded },
    };
  }

  private async apply(
    agg: RequestAggregate,
    actor: Actor,
    ctx: AuditCtx,
    c: {
      to: RequestAggregate['request']['status'];
      selectedEngineerId?: string | null;
      code: string;
      role: Role;
      exclude?: { engineerId: string; reason: string | null } | undefined;
      cancel?: { reason: string | null; by: Role };
      cancelOpenQuotes?: boolean;
    },
  ) {
    const r = agg.request;
    const ok = await this.repos.requests.apply(r.id, {
      expectedVersion: r.version,
      from: r.status,
      to: c.to,
      ...(c.selectedEngineerId !== undefined ? { selectedEngineerId: c.selectedEngineerId } : {}),
      ...(c.exclude ? { exclude: c.exclude } : {}),
      ...(c.cancel ? { cancel: c.cancel } : {}),
      ...(c.cancelOpenQuotes ? { cancelOpenQuotes: true } : {}),
      event: { code: c.code, actorId: actor.id, actorRole: c.role },
    });
    if (!ok) throw new DomainError('CONFLICT', 'Request changed, reload');
    await this.events.publish({
      type: c.code,
      requestId: r.id,
      actorUserId: actor.id,
      engineerId: c.selectedEngineerId ?? r.selectedEngineerId,
    });
    await this.repos.audit.record({
      ...ctx,
      action: `request.${c.code.toLowerCase()}`,
      entityType: 'ServiceRequest',
      entityId: r.id,
      before: { status: r.status, engineerId: r.selectedEngineerId },
      after: { status: c.to, engineerId: c.selectedEngineerId ?? r.selectedEngineerId },
    });
    return {
      data: {
        requestId: r.id,
        status: c.to,
        availableActions: allowedEvents(c.to, c.role === 'ADMIN' ? 'ADMIN' : c.role),
      },
    };
  }
}
