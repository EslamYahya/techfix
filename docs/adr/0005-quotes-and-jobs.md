# ADR 0005 — Quotes and jobs (phase 3)

Status: accepted

- Totals are computed by the server in exact money (`computeQuote`). The quote input is strict: a client that sends `total`, `totalPrice` or any unknown field gets a validation error instead of being trusted.
- Request ≠ Quote ≠ Job. Accepting a main quote marks it ACCEPTED, moves the request to QUOTE_ACCEPTED and creates the Job in one atomic operation (one DB transaction in Prisma). The accepted quote is never edited; extra work is a new ADDITIONAL quote linked to it, only while IN_PROGRESS and one at a time. The agreed total = accepted main + accepted extras.
- Finishing the job is blocked while an extra quote is waiting for the customer (PENDING_ADDITIONAL_QUOTE).
- Changing the engineer or cancelling withdraws open quotes. A quote older than 48 h cannot be accepted.
- Job steps (trip, arrive, start, complete, confirm) are request transitions plus a timestamp on the job, each audited. "Report a problem" opens a dispute and leaves the state as it is.
- Contact details unlock at CONFIRMED, as before.

Deferred to phase 4: choosing how to pay, which is what moves QUOTE_ACCEPTED to CONFIRMED (tests confirm the booking directly in storage until then), plus Idempotency-Key on accept/confirm.
Not verified in the build sandbox: the Prisma adapter's transactions on a live database.
