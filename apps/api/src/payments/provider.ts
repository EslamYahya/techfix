import { DomainError, type ProviderOutcome } from '@techfix/domain';

export type { ProviderOutcome };

/**
 * What the platform needs from an online payment provider. Everything Fawry-specific lives behind
 * this interface (see fawry.provider.ts), so the rules in `PaymentsService` never mention Fawry.
 */
export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

export interface ChargeInput {
  /** Our payment id — sent as the merchant reference, comes back in every callback. */
  paymentId: string;
  amount: number;
  description: string;
  customer: { name: string; phone: string; email: string | null };
  expiresAt: Date;
}
export interface ChargeResult {
  /** The provider's reference: for Fawry, the number the customer pays with at an outlet / in the app. */
  providerRef: string;
  expiresAt: Date | null;
  /** Hosted checkout page when the provider has one (card flows); null for reference-number flows. */
  checkoutUrl: string | null;
}

export interface ProviderEvent {
  /** Unique per callback; the same event delivered twice yields the same id. */
  externalId: string;
  paymentId: string;
  outcome: ProviderOutcome;
  /** The amount of OUR order as the provider recorded it (never includes the provider's fees).
   *  Null when the provider's status reply did not carry it — Fawry's status v2 reports the status
   *  and may omit the amounts, and a success that cannot be checked against our own amount is not
   *  acted on (see `decideWebhook`). */
  amount: number | null;
  providerRef: string | null;
  failureReason: string | null;
}

export interface PaymentProvider {
  readonly name: string;
  createCharge(input: ChargeInput): Promise<ChargeResult>;
  /**
   * Verifies the callback's signature and extracts what happened. Throws DomainError('UNAUTHORIZED')
   * for anything that is not a correctly signed callback.
   */
  parseWebhook(body: unknown): ProviderEvent;
  /** Asks the provider directly (reconciliation). Returns null when the provider does not know the order. */
  fetchStatus(paymentId: string): Promise<ProviderEvent | null>;
}

/** Used when no provider credentials are configured: cash keeps working, online says "unavailable". */
export class UnconfiguredProvider implements PaymentProvider {
  readonly name = 'none';
  async createCharge(): Promise<ChargeResult> {
    throw new DomainError('UNAVAILABLE', 'Online payment is not configured');
  }
  parseWebhook(): ProviderEvent {
    throw new DomainError('UNAUTHORIZED', 'No payment provider configured');
  }
  async fetchStatus(): Promise<ProviderEvent | null> {
    return null;
  }
}
