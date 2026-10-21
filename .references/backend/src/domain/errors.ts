/**
 * Stable machine codes returned in `error.code`. The client maps each code to an Arabic sentence
 * (see docs/10-frontend-contract.md). The server never returns user-facing Arabic text as the contract.
 */
export const ERROR_HTTP = {
  VALIDATION_ERROR: 422,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INVALID_STATE_TRANSITION: 409,
  PENDING_ADDITIONAL_QUOTE: 409,
  ENGINEER_NOT_ELIGIBLE: 409,
  ENGINEER_NOT_VERIFIED: 403,
  ACCOUNT_SUSPENDED: 403,
  PAYMENT_NOT_VERIFIED: 409,
  IDEMPOTENCY_CONFLICT: 409,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL: 500,
} as const;

export type ErrorCode = keyof typeof ERROR_HTTP;

export class DomainError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message?: string,
    public readonly details: unknown[] = [],
  ) {
    super(message ?? code);
    this.name = 'DomainError';
  }
  get httpStatus(): number {
    return ERROR_HTTP[this.code];
  }
}
