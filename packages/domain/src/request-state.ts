import { DomainError } from './errors';

export const REQUEST_STATUSES = [
  'REQUESTED',
  'MATCHING',
  'ENGINEER_SELECTED',
  'ENGINEER_ACCEPTED',
  'QUOTE_SENT',
  'QUOTE_REJECTED',
  'QUOTE_ACCEPTED',
  'CONFIRMED',
  'ON_THE_WAY',
  'ARRIVED',
  'IN_PROGRESS',
  'COMPLETION_PENDING',
  'COMPLETED',
  'RATED',
  'CANCELLED',
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export type Role = 'CUSTOMER' | 'ENGINEER' | 'ADMIN' | 'SYSTEM';

export type RequestEvent =
  | 'START_MATCHING'
  | 'SELECT_ENGINEER'
  | 'ENGINEER_ACCEPT'
  | 'ENGINEER_REJECT'
  | 'ENGINEER_TIMEOUT'
  | 'CHANGE_ENGINEER'
  | 'SEND_QUOTE'
  | 'ACCEPT_QUOTE'
  | 'REJECT_QUOTE'
  | 'CONFIRM_BOOKING'
  | 'START_TRIP'
  | 'ARRIVE'
  | 'START_JOB'
  | 'COMPLETE_JOB'
  | 'CONFIRM_COMPLETION'
  | 'RATE'
  | 'CANCEL';

interface Rule {
  from: readonly RequestStatus[];
  to: RequestStatus;
  actors: readonly Role[];
}

/**
 * The single source of truth for ServiceRequest/Job progress. Nothing in the codebase may write
 * `status` directly: every change goes through `transition()`.
 *
 * Differences vs. the prose blueprint (all deliberate, all mirrored in the frontend prototype):
 *  - QUOTE_REJECTED → engineer may send a revised quote (SEND_QUOTE) or customer may change engineer.
 *  - CONFIRM_BOOKING is fired by the customer (cash chosen) OR by the system (verified payment webhook).
 *  - ENGINEER_TIMEOUT is a SYSTEM event (worker) and behaves like a reject.
 */
export const TRANSITIONS: Record<Exclude<RequestEvent, 'CANCEL'>, Rule> = {
  START_MATCHING: { from: ['REQUESTED'], to: 'MATCHING', actors: ['SYSTEM'] },
  SELECT_ENGINEER: { from: ['MATCHING'], to: 'ENGINEER_SELECTED', actors: ['CUSTOMER', 'ADMIN'] },
  ENGINEER_ACCEPT: { from: ['ENGINEER_SELECTED'], to: 'ENGINEER_ACCEPTED', actors: ['ENGINEER'] },
  ENGINEER_REJECT: { from: ['ENGINEER_SELECTED'], to: 'MATCHING', actors: ['ENGINEER'] },
  ENGINEER_TIMEOUT: { from: ['ENGINEER_SELECTED'], to: 'MATCHING', actors: ['SYSTEM'] },
  CHANGE_ENGINEER: {
    from: ['ENGINEER_SELECTED', 'ENGINEER_ACCEPTED', 'QUOTE_SENT', 'QUOTE_REJECTED'],
    to: 'MATCHING',
    actors: ['CUSTOMER', 'ADMIN'],
  },
  SEND_QUOTE: {
    from: ['ENGINEER_ACCEPTED', 'QUOTE_REJECTED'],
    to: 'QUOTE_SENT',
    actors: ['ENGINEER'],
  },
  ACCEPT_QUOTE: { from: ['QUOTE_SENT'], to: 'QUOTE_ACCEPTED', actors: ['CUSTOMER'] },
  REJECT_QUOTE: { from: ['QUOTE_SENT'], to: 'QUOTE_REJECTED', actors: ['CUSTOMER'] },
  CONFIRM_BOOKING: { from: ['QUOTE_ACCEPTED'], to: 'CONFIRMED', actors: ['CUSTOMER', 'SYSTEM'] },
  START_TRIP: { from: ['CONFIRMED'], to: 'ON_THE_WAY', actors: ['ENGINEER'] },
  ARRIVE: { from: ['ON_THE_WAY'], to: 'ARRIVED', actors: ['ENGINEER'] },
  START_JOB: { from: ['ARRIVED'], to: 'IN_PROGRESS', actors: ['ENGINEER'] },
  COMPLETE_JOB: { from: ['IN_PROGRESS'], to: 'COMPLETION_PENDING', actors: ['ENGINEER'] },
  /** ADMIN: only as the outcome of a dispute (the customer reported a problem instead of confirming). */
  CONFIRM_COMPLETION: {
    from: ['COMPLETION_PENDING'],
    to: 'COMPLETED',
    actors: ['CUSTOMER', 'ADMIN'],
  },
  RATE: { from: ['COMPLETED'], to: 'RATED', actors: ['CUSTOMER'] },
};

/** Statuses from which a customer (or admin) may cancel without dispute handling. */
export const FREELY_CANCELLABLE: readonly RequestStatus[] = [
  'REQUESTED',
  'MATCHING',
  'ENGINEER_SELECTED',
  'ENGINEER_ACCEPTED',
  'QUOTE_SENT',
  'QUOTE_REJECTED',
  'QUOTE_ACCEPTED',
  'CONFIRMED',
];
/** Cancelling here is governed by the (still open) cancellation policy → goes through Admin/Dispute. */
export const POLICY_CANCELLABLE: readonly RequestStatus[] = [
  'ON_THE_WAY',
  'ARRIVED',
  'IN_PROGRESS',
];
export const TERMINAL: readonly RequestStatus[] = ['RATED', 'CANCELLED'];

export function transition(
  current: RequestStatus,
  event: RequestEvent,
  actor: Role,
): RequestStatus {
  if (event === 'CANCEL') {
    if (actor !== 'CUSTOMER' && actor !== 'ADMIN') throw new DomainError('FORBIDDEN');
    if (FREELY_CANCELLABLE.includes(current)) return 'CANCELLED';
    if (actor === 'ADMIN' && POLICY_CANCELLABLE.includes(current)) return 'CANCELLED';
    throw new DomainError('INVALID_STATE_TRANSITION', `Cannot cancel from ${current}`);
  }
  const rule = TRANSITIONS[event];
  if (!rule.actors.includes(actor)) throw new DomainError('FORBIDDEN', `${actor} cannot ${event}`);
  if (!rule.from.includes(current)) {
    throw new DomainError('INVALID_STATE_TRANSITION', `${event} is not allowed from ${current}`);
  }
  return rule.to;
}

/** Which events could this actor perform right now? Drives `availableActions` in API responses. */
export function allowedEvents(current: RequestStatus, actor: Role): RequestEvent[] {
  const out: RequestEvent[] = [];
  for (const [event, rule] of Object.entries(TRANSITIONS) as [
    Exclude<RequestEvent, 'CANCEL'>,
    Rule,
  ][]) {
    if (rule.actors.includes(actor) && rule.from.includes(current)) out.push(event);
  }
  if ((actor === 'CUSTOMER' || actor === 'ADMIN') && FREELY_CANCELLABLE.includes(current))
    out.push('CANCEL');
  return out;
}
