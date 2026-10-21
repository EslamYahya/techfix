# ADR 0002 — Response envelope and error codes

Status: accepted

Success: `{ data, meta? }`. Failure: `{ error: { code, message, details, requestId } }`.
`code` is a stable machine value from `@techfix/domain` (`ERROR_HTTP`); the web app maps every code to Arabic (`apps/web/src/labels`). The server never returns user-facing Arabic as the contract, and unexpected errors never leak internals.
A contract test keeps `ErrorCode` in `openapi.yaml` equal to the domain table; a web test keeps the Arabic dictionary complete.
