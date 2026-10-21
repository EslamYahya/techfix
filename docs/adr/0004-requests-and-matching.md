# ADR 0004 — Requests and matching (phase 2)

Status: accepted

- A request is created directly in MATCHING (timeline: REQUEST_CREATED). Every later change goes through `transition()` and a version check (optimistic lock); a stale write answers CONFLICT.
- Authorization order in the service: permission → exists → ownership (404 for non-owners) → state. Admin can read any request but cannot act as the customer in this phase.
- Matching = eligibility gates, then ranking (weights 35/25/15/15/10). Candidates come from PostGIS (`ST_DWithin` within each engineer's own radius); the in-memory adapter uses haversine. Selection re-checks eligibility, so a stale list cannot book an engineer who went offline. The API returns order and reasons, never the score.
- An engineer who declines, or whom the customer replaces, is stored as excluded for that request only.
- The engineer sees the customer's first name and area until CONFIRMED (`redactForEngineer`); the customer sees the engineer's phone only from CONFIRMED.
- The web form picks a coarse area with a fixed centre point; a map picker replaces it later.

Deferred: Idempotency-Key on request creation (arrives with payments in phase 4), engineer response timeout (worker, phase 5), attachments upload (object storage), quotes and jobs (phase 3).
Not verified in the build sandbox: the PostGIS matching query and the Prisma adapter on a live database.
