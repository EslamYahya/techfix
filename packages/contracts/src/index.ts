/**
 * Shared API contract.
 *  - `paths` / `components` / `operations` are GENERATED from openapi.yaml (never edit src/api.d.ts).
 *  - Error codes and the request-status list come from @techfix/domain so there is one definition.
 */
export type { paths, components, operations } from './api';
export { ERROR_HTTP, REQUEST_STATUSES } from '@techfix/domain';
export type { ErrorCode, RequestStatus } from '@techfix/domain';

import type { components } from './api';
export type ErrorEnvelope = components['schemas']['ErrorEnvelope'];
export type TransitionEnvelope = components['schemas']['TransitionEnvelope'];
export type QuoteInput = components['schemas']['QuoteInput'];
export type CreateRequestInput = components['schemas']['CreateRequestInput'];
export type Recommendation = components['schemas']['Recommendation'];
