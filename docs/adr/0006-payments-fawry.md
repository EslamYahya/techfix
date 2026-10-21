# ADR 0006 — Payments (cash + Fawry) and ratings

Status: accepted · Phase 4

## Decisions

1. **Online provider = Fawry**, "pay at Fawry" reference-number flow. We create an order at Fawry; the
   customer gets a reference number and pays at an outlet or in the Fawry app. Everything Fawry-specific
   is in `apps/api/src/payments/fawry.provider.ts` behind the `PaymentProvider` interface
   (`createCharge`, `parseWebhook`, `fetchStatus`). Swapping provider later touches that one file.
2. **Money rules live in `@techfix/domain`** (`decideWebhook`, `assertCanCreatePayment`,
   `assertCanConfirmCash`, `canRate`, `effectiveStatusForProvider`) and are applied by `PaymentsService`.
3. **Cash**: choosing cash at `QUOTE_ACCEPTED` creates a PENDING cash payment and confirms the booking in
   the same transaction. The engineer confirms receipt only at `COMPLETED`; the amount recorded is what is
   due at that moment (so extra work agreed later is included).
4. **Online**: the booking is confirmed **only** by a verified provider callback (or by reconciliation, which
   goes through the same code). The browser returning from Fawry is never trusted; the web app just polls
   the request every 5 s while an online payment is pending.
5. **Amount is never taken from a client**: `POST /jobs/:id/payments` accepts only `{method}`; the amount is
   what is still due. Unknown body fields are rejected (422).
6. **One payment at a time**: a pending online payment blocks any second payment (it could still be paid at
   Fawry). DB backstop: partial unique index `payments_one_pending_online` (in `prisma/notes/postgis.sql`).
7. **Webhook** (`POST /payments/webhook`, no JWT):
   - verify SHA-256 signature (constant-time) → else 401, nothing stored;
   - store the raw event (`webhook_events`, unique on provider + external id) → replay answers 200, applies once;
   - `merchantRefNumber` = our payment id (dashes removed) → look the payment up; unknown → stored + audited;
   - **amount mismatch** (Fawry `orderAmount` ≠ our amount) → not accepted, audited `payment.amount_mismatch`;
   - success → payment PAID (+ `CONFIRM_BOOKING` by SYSTEM if the request is still `QUOTE_ACCEPTED`) in one
     transaction; failure/expiry → FAILED so the customer can start a new order;
   - a **late success after EXPIRED** is honoured (the money was taken);
   - if processing throws, the event stays unprocessed and Fawry's retry runs it again.
     Answer is an empty 200, as Fawry requires.
8. **Reconciliation**: `PaymentsService.reconcilePending()` asks Fawry (status v2) about online payments that
   are still pending after `PAYMENT_RECONCILE_AFTER_MINUTES` and applies the answer via the webhook path.
   Exposed as `POST /admin/payments/reconcile` now; the scheduled job arrives with the worker in phase 5.
9. **Idempotency-Key** (header, optional but sent by the web app) on: create payment, confirm cash.
   Same key + same request → first response replayed; same key + different request → 409
   `IDEMPOTENCY_CONFLICT`. Only successful responses are stored.
10. **Rating**: `POST /jobs/:id/review` — customer only, request `COMPLETED` **and fully paid** (else
    `PAYMENT_NOT_VERIFIED`), once per job (unique), moves the request to `RATED` and recomputes the
    engineer's average/count (hidden reviews excluded) in the same transaction. Public review shape shows the
    customer's first name only.

## Env

`FAWRY_MERCHANT_CODE`, `FAWRY_SECURITY_KEY`, `FAWRY_BASE_URL` (all three or none; none = cash only, online
answers 503), `FAWRY_WEBHOOK_URL` (optional), `PAYMENT_EXPIRY_HOURS`, `PAYMENT_RECONCILE_AFTER_MINUTES`,
`IDEMPOTENCY_TTL_HOURS`. Real values never go in git.

## NOT verified — do before go-live

The Fawry adapter was written from Fawry's public developer docs and tested against a **stub** of Fawry
(tests sign callbacks with the documented field order). It has **not** been run against Fawry's staging server
(not reachable from the build sandbox, and no merchant account yet). With a sandbox merchant account, check:

- [ ] `paymentMethod` value in the charge request (we send `PAYATFAWRY`; one docs page spells it `PayAtFawry`)
      and that charge signature order matches (`merchantCode + merchantRefNum + paymentMethod + amount + key`;
      `customerProfileId` is not sent).
- [ ] Callback signature order and number formatting (`fawryRefNumber, merchantRefNumber, paymentAmount(2dp),
orderAmount(2dp), orderStatus, paymentMethod, [paymentRefrenceNumber], key`, no separators).
- [ ] That `orderAmount` equals the amount we sent (we compare it; `paymentAmount` may include Fawry fees).
- [ ] Status v2: query-string vs JSON body, and the possible `paymentStatus` values (we map PAID / FAILED /
      CANCELED / EXPIRED, anything else = still pending).
- [ ] That a `merchantRefNum` of 32 hex chars is accepted; `customerEmail` is required by Fawry — accounts
      without an e-mail use `FAWRY_FALLBACK_EMAIL`.
- [ ] Production base URL and callback URL registration in Fawry's merchant portal.
- [ ] The PostgreSQL adapter for payments/reviews/idempotency (`prisma-repos.ts`) is typechecked by review only:
      the Prisma client cannot be generated in the build sandbox. Run the API tests with `TEST_DATABASE_URL`
      once, and add the `payments.expires_at` column + the partial index to the first migration.

## Open decisions (not invented here)

Commission %, refund/dispute policy (the admin refund endpoint is declared in OpenAPI but **not implemented**
— phase 6), what happens to a cash booking the customer cancels after confirmation, payment expiry (24 h
placeholder). A paid order whose request was cancelled meanwhile is audited as `payment.needs_refund`.
