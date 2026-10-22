import { createHash, timingSafeEqual } from 'node:crypto';
import { DomainError } from '@techfix/domain';
import { z } from 'zod';
import type {
  ChargeInput,
  ChargeResult,
  PaymentProvider,
  ProviderEvent,
  ProviderOutcome,
} from './provider.js';

/**
 * Fawry ("FawryPay") adapter — pay-at-Fawry reference-number flow.
 *
 * Written from Fawry's public developer docs (developer.fawrystaging.com: "Create payment requests
 * using FawryPay reference number", "Server notification V2", "Get payment status V2").
 * NOT yet exercised against Fawry's staging servers — see docs/adr/0006-payments-fawry.md for the
 * checklist to run once a merchant sandbox account exists. Everything that could differ is in this file.
 */
export const PAY_AT_FAWRY = 'PAYATFAWRY';

export interface FawryConfig {
  merchantCode: string;
  secureKey: string;
  /** e.g. https://atfawry.fawrystaging.com (sandbox) — no trailing path. */
  baseUrl: string;
  /** Sent as orderWebHookUrl when set; otherwise the callback URL configured in Fawry's merchant portal is used. */
  webhookUrl?: string | undefined;
  /** Fawry requires an e-mail; accounts without one use this placeholder. */
  fallbackEmail: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

const sha256 = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');
const money = (n: number | string) => Number(n).toFixed(2);

/** merchantRefNum = payment id without dashes (plain alphanumerics are safest for a third-party reference). */
export const toMerchantRef = (paymentId: string) => paymentId.replaceAll('-', '');
export const fromMerchantRef = (ref: string): string | null => {
  const m = /^([0-9a-f]{8})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{12})$/i.exec(ref);
  return m ? m.slice(1).join('-').toLowerCase() : null;
};

const num = z.union([z.number(), z.string()]).transform(Number);
const WebhookSchema = z.object({
  fawryRefNumber: z.coerce.string().min(1),
  merchantRefNumber: z.coerce.string().min(1),
  paymentAmount: num,
  orderAmount: num,
  orderStatus: z.string().min(1),
  paymentMethod: z.string().min(1),
  paymentRefrenceNumber: z.coerce.string().nullish(), // sic — Fawry's spelling
  messageSignature: z.string().min(1),
  failureReason: z.string().nullish(),
});
const ChargeResponseSchema = z.object({
  statusCode: z.coerce.number(),
  statusDescription: z.string().optional(),
  referenceNumber: z.coerce.string().optional(),
});
const StatusResponseSchema = z.object({
  statusCode: z.coerce.number().optional(),
  referenceNumber: z.coerce.string().nullish(),
  fawryRefNumber: z.coerce.string().nullish(),
  paymentStatus: z.string().nullish(),
  orderStatus: z.string().nullish(),
  orderAmount: num.nullish(),
  paymentAmount: num.nullish(),
  failureReason: z.string().nullish(),
});

/** orderStatus values Fawry documents: NEW, PAID, CANCELED, REFUNDED, EXPIRED, PARTIAL_REFUNDED, FAILED. */
export function outcomeOf(status: string): ProviderOutcome {
  switch (status.toUpperCase()) {
    case 'PAID':
      return 'SUCCESS';
    case 'FAILED':
    case 'CANCELED':
    case 'CANCELLED':
    case 'EXPIRED':
      return 'FAILED';
    default: // NEW, UNPAID, REFUNDED, PARTIAL_REFUNDED … change nothing here (refunds are an admin action)
      return 'PENDING';
  }
}

export class FawryProvider implements PaymentProvider {
  readonly name = 'fawry';
  private readonly f: typeof fetch;
  constructor(private readonly cfg: FawryConfig) {
    this.f = cfg.fetchImpl ?? fetch;
  }

  /** SHA-256(merchantCode + merchantRefNum + [customerProfileId] + paymentMethod + amount(2dp) + secureKey). */
  chargeSignature(merchantRefNum: string, amount: number): string {
    return sha256(
      this.cfg.merchantCode + merchantRefNum + PAY_AT_FAWRY + money(amount) + this.cfg.secureKey,
    );
  }

  /** SHA-256(fawryRefNumber + merchantRefNumber + paymentAmount + orderAmount + orderStatus + paymentMethod + [paymentRefrenceNumber] + secureKey). */
  callbackSignature(b: {
    fawryRefNumber: string;
    merchantRefNumber: string;
    paymentAmount: number;
    orderAmount: number;
    orderStatus: string;
    paymentMethod: string;
    paymentRefrenceNumber?: string | null | undefined;
  }): string {
    return sha256(
      b.fawryRefNumber +
        b.merchantRefNumber +
        money(b.paymentAmount) +
        money(b.orderAmount) +
        b.orderStatus +
        b.paymentMethod +
        (b.paymentRefrenceNumber ?? '') +
        this.cfg.secureKey,
    );
  }

  async createCharge(i: ChargeInput): Promise<ChargeResult> {
    const merchantRefNum = toMerchantRef(i.paymentId);
    const body = {
      merchantCode: this.cfg.merchantCode,
      merchantRefNum,
      paymentMethod: PAY_AT_FAWRY,
      customerName: i.customer.name,
      customerMobile: i.customer.phone,
      customerEmail: i.customer.email ?? this.cfg.fallbackEmail,
      amount: money(i.amount),
      currencyCode: 'EGP',
      description: i.description,
      language: 'ar-eg',
      paymentExpiry: i.expiresAt.getTime(),
      chargeItems: [
        { itemId: merchantRefNum, description: i.description, price: money(i.amount), quantity: 1 },
      ],
      ...(this.cfg.webhookUrl ? { orderWebHookUrl: this.cfg.webhookUrl } : {}),
      signature: this.chargeSignature(merchantRefNum, i.amount),
    };
    const json = await this.call(`${this.cfg.baseUrl}/ECommerceWeb/Fawry/payments/charge`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const r = ChargeResponseSchema.safeParse(json);
    if (!r.success || r.data.statusCode !== 200 || !r.data.referenceNumber)
      throw new DomainError('UNAVAILABLE', 'Payment provider rejected the order');
    return { providerRef: r.data.referenceNumber, expiresAt: i.expiresAt, checkoutUrl: null };
  }

  parseWebhook(raw: unknown): ProviderEvent {
    const parsed = WebhookSchema.safeParse(raw);
    if (!parsed.success) throw new DomainError('UNAUTHORIZED', 'Bad webhook');
    const b = parsed.data;
    const expected = Buffer.from(this.callbackSignature(b), 'hex');
    const given = Buffer.from(b.messageSignature.toLowerCase(), 'hex');
    if (expected.length !== given.length || !timingSafeEqual(expected, given))
      throw new DomainError('UNAUTHORIZED', 'Bad webhook signature');
    const paymentId = fromMerchantRef(b.merchantRefNumber);
    return {
      // Fawry re-sends one callback per status change, so the status is part of the identity.
      externalId: `${b.fawryRefNumber}:${b.merchantRefNumber}:${b.orderStatus}:${b.paymentRefrenceNumber ?? ''}`,
      // An unparsable reference is signed by Fawry but is not ours: surfaced as "unknown payment".
      paymentId: paymentId ?? b.merchantRefNumber,
      outcome: outcomeOf(b.orderStatus),
      amount: b.orderAmount,
      providerRef: b.fawryRefNumber,
      failureReason: b.failureReason ?? null,
    };
  }

  /** SHA-256(merchantCode + merchantRefNumber + secureKey). */
  async fetchStatus(paymentId: string): Promise<ProviderEvent | null> {
    const ref = toMerchantRef(paymentId);
    const q = new URLSearchParams({
      merchantCode: this.cfg.merchantCode,
      merchantRefNumber: ref,
      signature: sha256(this.cfg.merchantCode + ref + this.cfg.secureKey),
    });
    const json = await this.call(
      `${this.cfg.baseUrl}/ECommerceWeb/Fawry/payments/status/v2?${q.toString()}`,
      { method: 'GET' },
    );
    const r = StatusResponseSchema.safeParse(json);
    if (!r.success) throw new DomainError('UNAVAILABLE', 'Unreadable provider status');
    const s = r.data;
    const status = s.paymentStatus ?? s.orderStatus;
    if (!status || (s.statusCode !== undefined && s.statusCode !== 200)) return null;
    // Status v2 reports `paymentStatus` (or `orderStatus`) and may omit `orderAmount`/`paymentAmount`
    // — Fawry's own status examples carry only the status. The verdict still has to reach the
    // caller: "UNPAID" must leave the payment pending and "EXPIRED" must fail it. A missing amount
    // is not an unusable reply, so it is passed on as null and the money check in `decideWebhook`
    // refuses to act on a success it cannot verify.
    const amount = s.orderAmount ?? s.paymentAmount ?? null;
    const providerRef = s.referenceNumber ?? s.fawryRefNumber ?? null;
    return {
      externalId: `status:${ref}:${status}`,
      paymentId,
      outcome: outcomeOf(status),
      amount,
      providerRef,
      failureReason: s.failureReason ?? null,
    };
  }

  private async call(url: string, init: RequestInit): Promise<unknown> {
    try {
      const res = await this.f(url, {
        ...init,
        signal: AbortSignal.timeout(this.cfg.timeoutMs ?? 15_000),
      });
      if (!res.ok) throw new DomainError('UNAVAILABLE', `Provider HTTP ${res.status}`);
      return (await res.json()) as unknown;
    } catch (e) {
      if (e instanceof DomainError) throw e;
      throw new DomainError('UNAVAILABLE', 'Payment provider unreachable');
    }
  }
}
