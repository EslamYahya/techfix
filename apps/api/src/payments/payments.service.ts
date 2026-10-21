import { Inject, Injectable } from '@nestjs/common';
import { DomainEvents } from '../events/domain-events.js';
import {
  ACTION_GUARDS,
  DomainError,
  agreedTotal,
  assertCanConfirmCash,
  assertCanCreatePayment,
  authorize,
  cashAmountDue,
  decideWebhook,
  effectiveStatusForProvider,
  transition,
  type Actor,
  type PaymentMethod,
} from '@techfix/domain';
import { z } from 'zod';
import type { AuditCtx } from '../catalog/catalog.service.js';
import { parse } from '../common/zod.js';
import { ENV, type Env } from '../config/env.js';
import { REPOS, type PaymentRecord, type RequestChange, type Repos } from '../repos.js';
import { RequestsService, numberOf } from '../requests/requests.service.js';
import { paymentDto, summaryOf } from './payment.dto.js';
import { PAYMENT_PROVIDER, type PaymentProvider, type ProviderEvent } from './provider.js';

const isUuid = (s: string) => z.uuid().safeParse(s).success;
const CreateSchema = z.object({ method: z.enum(['CASH', 'ONLINE']) }).strict();

const BOOKING_CONFIRMED = (version: number, actorId: string | null, role: 'CUSTOMER' | 'SYSTEM') =>
  ({
    expectedVersion: version,
    from: 'QUOTE_ACCEPTED',
    to: 'CONFIRMED',
    jobStamp: 'confirmedAt',
    event: { code: 'BOOKING_CONFIRMED', actorId, actorRole: role },
  }) satisfies RequestChange;

export type ApplyResult =
  'UNKNOWN_PAYMENT' | 'IGNORED' | 'DUPLICATE' | 'AMOUNT_MISMATCH' | 'PAID' | 'FAILED';

@Injectable()
export class PaymentsService {
  constructor(
    @Inject(REPOS) private readonly repos: Repos,
    @Inject(ENV) private readonly env: Env,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    @Inject(RequestsService) private readonly requests: RequestsService,
    @Inject(DomainEvents) private readonly events: DomainEvents,
  ) {}

  /** Customer picks how to pay. The amount is never read from the body: it is what is still due. */
  async create(actor: Actor, jobId: string, body: unknown, ctx: AuditCtx) {
    const { method } = parse(CreateSchema, body);
    const { job, agg } = await this.findJob(actor, jobId, ACTION_GUARDS['createPayment']!);
    const [quotes, payments] = await Promise.all([
      this.repos.quotes.list(agg.request.id),
      this.repos.payments.listForJob(job.id),
    ]);
    const summary = summaryOf(agreedTotal(quotes), payments);
    const { amount } = assertCanCreatePayment({
      requestStatus: agg.request.status,
      method,
      summary,
      hasPendingOnline: payments.some((p) => p.method === 'ONLINE' && p.status === 'PENDING'),
    });

    if (method === 'CASH') {
      // Choosing cash confirms the booking right away (Release v1): the engineer collects after completion.
      transition(agg.request.status, 'CONFIRM_BOOKING', 'CUSTOMER');
      const rec = await this.repos.payments.create(
        { jobId: job.id, amount, method, provider: null },
        BOOKING_CONFIRMED(agg.request.version, actor.id, 'CUSTOMER'),
      );
      if (!rec) throw new DomainError('CONFLICT', 'Request changed, reload');
      await this.events.publish({
        type: 'BOOKING_CONFIRMED',
        requestId: agg.request.id,
        actorUserId: actor.id,
        jobId: job.id,
      });
      await this.audit(ctx, 'payment.cash_chosen', rec, { amount });
      return { data: this.createdDto(rec, agg.request.id) };
    }

    // ONLINE: the row exists before the provider is called, so a callback can never arrive for an unknown order.
    let rec = await this.repos.payments.create({
      jobId: job.id,
      amount,
      method,
      provider: this.provider.name,
    });
    if (!rec) throw new DomainError('CONFLICT', 'Request changed, reload');
    try {
      const account = await this.repos.identity.findById(actor.id);
      const charge = await this.provider.createCharge({
        paymentId: rec.id,
        amount,
        description: `خدمة ${numberOf(agg.request.number)} — ${agg.service.name}`,
        customer: {
          name: agg.customer.name,
          phone: agg.customer.phone,
          email: account?.user.email ?? null,
        },
        expiresAt: new Date(Date.now() + this.env.PAYMENT_EXPIRY_HOURS * 3_600_000),
      });
      await this.repos.payments.attachProvider(rec.id, {
        providerRef: charge.providerRef,
        expiresAt: charge.expiresAt,
      });
      rec = { ...rec, providerRef: charge.providerRef, expiresAt: charge.expiresAt };
      await this.audit(ctx, 'payment.online_started', rec, { amount });
      return {
        data: { ...this.createdDto(rec, agg.request.id), checkoutUrl: charge.checkoutUrl },
      };
    } catch (e) {
      await this.repos.payments.discard(rec.id, 'PROVIDER_ORDER_FAILED');
      throw e;
    }
  }

  async list(actor: Actor, jobId: string) {
    const permission = actor.role === 'ADMIN' ? 'payments.read' : 'payments.read.own';
    const { job, agg } = await this.findJob(actor, jobId, { permission });
    const [quotes, payments] = await Promise.all([
      this.repos.quotes.list(agg.request.id),
      this.repos.payments.listForJob(job.id),
    ]);
    return {
      data: { ...summaryOf(agreedTotal(quotes), payments), payments: payments.map(paymentDto) },
    };
  }

  /** The engineer confirms the cash they received — only after the customer confirmed completion. */
  async confirmCash(actor: Actor, jobId: string, ctx: AuditCtx) {
    const { job, agg } = await this.findJob(actor, jobId, ACTION_GUARDS['confirmCash']!);
    const [quotes, payments] = await Promise.all([
      this.repos.quotes.list(agg.request.id),
      this.repos.payments.listForJob(job.id),
    ]);
    const summary = summaryOf(agreedTotal(quotes), payments);
    const cash = payments.find((p) => p.method === 'CASH' && p.status === 'PENDING');
    assertCanConfirmCash(agg.request.status, cash, summary.due);
    // Extra work agreed after booking raised the total: the cash due is the total at this moment.
    const ok = await this.repos.payments.confirmCash(cash!.id, {
      amount: cashAmountDue(summary),
      engineerUserId: actor.id,
    });
    if (!ok) throw new DomainError('CONFLICT', 'Already confirmed');
    await this.events.publish({
      type: 'CASH_RECEIVED',
      requestId: agg.request.id,
      actorUserId: actor.id,
      jobId: job.id,
    });
    await this.audit(ctx, 'payment.cash_confirmed', cash!, { amount: summary.due });
    const after = summaryOf(agreedTotal(quotes), await this.repos.payments.listForJob(job.id));
    return { data: { jobId: job.id, requestId: agg.request.id, ...after } };
  }

  // ---- provider side -------------------------------------------------------------------------

  /** `POST /payments/webhook`. Authenticated by signature only; always 200 once the signature is valid. */
  async handleWebhook(body: unknown): Promise<void> {
    const ev = this.provider.parseWebhook(body); // throws UNAUTHORIZED on a bad signature
    const rec = await this.repos.payments.recordWebhook({
      provider: this.provider.name,
      externalId: ev.externalId,
      payload: body,
      signatureOk: true,
    });
    if (rec.duplicate) return;
    // If applying throws, the event stays unprocessed and the provider's retry runs it again.
    const result = await this.applyProviderEvent(ev, 'webhook');
    await this.repos.payments.finishWebhook(
      rec.id,
      result === 'UNKNOWN_PAYMENT' || result === 'AMOUNT_MISMATCH' ? result : null,
    );
  }

  /**
   * Safety net for a lost or late callback: asks the provider about every online payment that is
   * still pending after a while and applies the answer through the same code path as a webhook.
   */
  async reconcile(actor: Actor, ctx: AuditCtx) {
    authorize(actor, ACTION_GUARDS['reconcilePayments']!);
    return { data: await this.reconcilePending(ctx) };
  }

  /** Also what the background worker (phase 5) calls on a schedule. */
  async reconcilePending(
    ctx: Pick<AuditCtx, 'requestId'> & Partial<AuditCtx> = { requestId: null },
  ) {
    const olderThan = new Date(Date.now() - this.env.PAYMENT_RECONCILE_AFTER_MINUTES * 60_000);
    const pending = await this.repos.payments.listPendingOnline(olderThan);
    const out = { checked: pending.length, paid: 0, failed: 0, unchanged: 0, errors: 0 };
    for (const p of pending) {
      try {
        const ev = await this.provider.fetchStatus(p.id);
        const r = ev ? await this.applyProviderEvent(ev, 'reconcile') : 'IGNORED';
        if (r === 'PAID') out.paid++;
        else if (r === 'FAILED') out.failed++;
        else out.unchanged++;
      } catch {
        out.errors++;
      }
    }
    await this.repos.audit.record({
      actorUserId: ctx.actorUserId ?? null,
      requestId: ctx.requestId ?? null,
      ip: ctx.ip ?? null,
      action: 'payment.reconcile',
      entityType: 'Payment',
      entityId: '-',
      after: out,
    });
    return out;
  }

  /** The single place a provider's verdict changes anything. Webhook and reconciliation both end here. */
  async applyProviderEvent(
    ev: ProviderEvent,
    source: 'webhook' | 'reconcile',
  ): Promise<ApplyResult> {
    const payment = isUuid(ev.paymentId) ? await this.repos.payments.get(ev.paymentId) : null;
    if (!payment) {
      await this.system('payment.unknown_reference', ev.paymentId, { source });
      return 'UNKNOWN_PAYMENT';
    }
    if (ev.outcome === 'PENDING') return 'IGNORED';
    const job = (await this.repos.jobs.get(payment.jobId))!;
    const agg = (await this.repos.requests.get(job.requestId))!;

    const effect = decideWebhook({
      alreadyProcessed: false,
      signatureOk: true, // verified by the provider adapter before we get here
      providerStatus: ev.outcome,
      providerAmount: ev.amount,
      payment: {
        status: effectiveStatusForProvider(payment.status, ev.outcome),
        amount: payment.amount,
      },
      requestStatus: agg.request.status,
    });

    if (effect.kind === 'IGNORE_DUPLICATE') return 'DUPLICATE';
    if (effect.kind === 'AMOUNT_MISMATCH') {
      // Money of a different size than we asked for is never accepted automatically.
      await this.system('payment.amount_mismatch', payment.id, {
        source,
        expected: payment.amount,
        got: ev.amount,
      });
      await this.events.publish({ type: 'PAYMENT_NEEDS_REVIEW', requestId: job.requestId });
      return 'AMOUNT_MISMATCH';
    }
    if (effect.kind === 'MARK_FAILED') {
      const r = await this.repos.payments.settle(payment.id, {
        status: 'FAILED',
        failureReason: ev.failureReason,
      });
      if (r.settled) {
        await this.system('payment.failed', payment.id, { source });
        await this.events.publish({
          type: 'PAYMENT_FAILED',
          requestId: job.requestId,
          jobId: job.id,
        });
      }
      return r.settled ? 'FAILED' : 'DUPLICATE';
    }

    // MARK_PAID — and, while the request still waits at QUOTE_ACCEPTED, the booking is confirmed in the same transaction.
    const change = effect.confirmBooking
      ? BOOKING_CONFIRMED(agg.request.version, null, 'SYSTEM')
      : undefined;
    const r = await this.repos.payments.settle(
      payment.id,
      { status: 'PAID', providerRef: ev.providerRef },
      change,
    );
    if (!r.settled) return 'DUPLICATE';
    await this.system('payment.paid', payment.id, { source, amount: payment.amount });

    let confirmed = r.changed;
    if (effect.confirmBooking && !confirmed) {
      // Someone touched the request between our read and the write: look again and retry once.
      const fresh = await this.repos.requests.get(job.requestId);
      if (fresh?.request.status === 'QUOTE_ACCEPTED')
        confirmed = await this.repos.requests.apply(
          fresh.request.id,
          BOOKING_CONFIRMED(fresh.request.version, null, 'SYSTEM'),
        );
    }
    const now = (await this.repos.requests.get(job.requestId))!.request.status;
    const common = { requestId: job.requestId, jobId: job.id };
    if (confirmed) await this.events.publish({ type: 'BOOKING_CONFIRMED', ...common });
    else await this.events.publish({ type: 'PAYMENT_PAID', ...common });
    if (now === 'CANCELLED') {
      await this.system('payment.needs_refund', payment.id, { source });
      await this.events.publish({ type: 'PAYMENT_NEEDS_REVIEW', ...common });
    } else if (effect.confirmBooking && !confirmed) {
      await this.system('payment.booking_not_confirmed', payment.id, { source, status: now });
      await this.events.publish({ type: 'PAYMENT_NEEDS_REVIEW', ...common });
    }
    return 'PAID';
  }

  // ---- helpers ------------------------------------------------------------------------------

  private createdDto(rec: PaymentRecord, requestId: string) {
    return {
      requestId,
      paymentId: rec.id,
      method: rec.method as PaymentMethod,
      status: rec.status,
      amount: rec.amount,
      reference: rec.providerRef,
      expiresAt: rec.expiresAt?.toISOString() ?? null,
      checkoutUrl: null as string | null,
    };
  }

  private audit(ctx: AuditCtx, action: string, p: PaymentRecord, after: unknown) {
    return this.repos.audit.record({
      ...ctx,
      action,
      entityType: 'Payment',
      entityId: p.id,
      after,
    });
  }

  private system(action: string, entityId: string, after: unknown) {
    return this.repos.audit.record({
      actorUserId: null,
      action,
      entityType: 'Payment',
      entityId,
      after,
    });
  }

  private async findJob(
    actor: Actor,
    jobId: string,
    guard: Parameters<RequestsService['load']>[2],
  ) {
    authorize(actor, guard);
    const job = isUuid(jobId) ? await this.repos.jobs.get(jobId) : null;
    if (!job) throw new DomainError('NOT_FOUND');
    const agg = await this.requests.load(actor, job.requestId, guard);
    return { job, agg };
  }
}
