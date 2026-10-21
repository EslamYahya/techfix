import { DomainError } from './errors';
import { RequestStatus, Role } from './request-state';

/** Permission catalogue — verbatim from Release v1 §Permissions (CUSTOMER / ENGINEER / ADMIN). */
export const PERMISSIONS = {
  CUSTOMER: [
    'profile.read', 'profile.update', 'services.read', 'requests.create', 'requests.read.own', 'requests.cancel.own',
    'engineers.read', 'engineers.choose', 'quotes.read.own', 'quotes.accept.own', 'quotes.reject.own',
    'payments.create', 'payments.read.own', 'jobs.read.own', 'jobs.confirm.own', 'reviews.create', 'notifications.read.own',
    'disputes.create',
  ],
  ENGINEER: [
    'profile.read', 'profile.update', 'services.manage.own', 'availability.manage.own', 'location.manage.own',
    'requests.read.assigned', 'requests.accept', 'requests.reject', 'quotes.create', 'quotes.read.own',
    'jobs.read.assigned', 'jobs.start', 'jobs.arrive', 'jobs.complete', 'payments.read.own', 'payments.confirm.cash',
    'reviews.read.own', 'notifications.read.own', 'disputes.create',
  ],
  ADMIN: [
    'users.read', 'users.update', 'users.suspend', 'engineers.read', 'engineers.verify', 'engineers.suspend',
    'customers.read', 'services.manage', 'requests.read', 'requests.manage', 'quotes.read', 'jobs.read',
    'payments.read', 'payments.refund', 'reviews.read', 'reviews.moderate', 'disputes.manage', 'shops.manage',
    'products.manage', 'platform.settings.manage',
  ],
} as const satisfies Record<Exclude<Role, 'SYSTEM'>, readonly string[]>;

export type Permission = (typeof PERMISSIONS)[Exclude<Role, 'SYSTEM'>][number];

export const hasPermission = (role: Exclude<Role, 'SYSTEM'>, p: string): boolean =>
  (PERMISSIONS[role] as readonly string[]).includes(p);

export interface Actor {
  id: string; // user id
  role: Exclude<Role, 'SYSTEM'>;
  profileId?: string; // customer/engineer profile id
  userStatus: 'ACTIVE' | 'SUSPENDED' | 'PENDING';
  verification?: 'PENDING' | 'VERIFIED' | 'REJECTED'; // engineers only
}
export interface RequestResource {
  customerId: string; // profile id
  selectedEngineerId: string | null; // profile id
  status: RequestStatus;
}

export interface Guard {
  permission: Permission;
  /** The statuses in which the action makes sense (the state-machine enforces the exact edge). */
  states?: readonly RequestStatus[];
}

/**
 * Authorization = Permission + Ownership + Current state (+ account health).
 * Order matters for information hiding:
 *   401 (no actor) → 403 (missing permission) → 404 (not your resource) → account checks → 409 (wrong state)
 * A non-owner gets 404, never 403, so request ids cannot be probed.
 */
export function authorize(actor: Actor | null, guard: Guard, resource?: RequestResource): void {
  if (!actor) throw new DomainError('UNAUTHORIZED');
  if (actor.userStatus === 'SUSPENDED') throw new DomainError('ACCOUNT_SUSPENDED');
  if (!hasPermission(actor.role, guard.permission)) throw new DomainError('FORBIDDEN');

  if (resource && actor.role !== 'ADMIN') {
    const owns =
      (actor.role === 'CUSTOMER' && resource.customerId === actor.profileId) ||
      (actor.role === 'ENGINEER' && resource.selectedEngineerId !== null && resource.selectedEngineerId === actor.profileId);
    if (!owns) throw new DomainError('NOT_FOUND');
  }
  if (actor.role === 'ENGINEER' && guard.permission !== 'profile.read' && guard.permission !== 'profile.update') {
    if (actor.verification !== 'VERIFIED' && isOperational(guard.permission)) throw new DomainError('ENGINEER_NOT_VERIFIED');
  }
  if (resource && guard.states && !guard.states.includes(resource.status)) {
    throw new DomainError('INVALID_STATE_TRANSITION', `Not allowed while ${resource.status}`);
  }
}

const isOperational = (p: Permission) =>
  ['requests.accept', 'quotes.create', 'jobs.start', 'jobs.arrive', 'jobs.complete', 'availability.manage.own'].includes(p);

/** Endpoint → guard table. The HTTP layer reads this; tests assert it matches openapi.yaml. */
export const ACTION_GUARDS: Record<string, Guard> = {
  createRequest: { permission: 'requests.create' },
  selectEngineer: { permission: 'engineers.choose', states: ['MATCHING'] },
  changeEngineer: { permission: 'engineers.choose', states: ['ENGINEER_SELECTED', 'ENGINEER_ACCEPTED', 'QUOTE_SENT', 'QUOTE_REJECTED'] },
  cancelRequest: { permission: 'requests.cancel.own' },
  engineerAccept: { permission: 'requests.accept', states: ['ENGINEER_SELECTED'] },
  engineerReject: { permission: 'requests.reject', states: ['ENGINEER_SELECTED'] },
  createQuote: { permission: 'quotes.create', states: ['ENGINEER_ACCEPTED', 'QUOTE_REJECTED'] },
  createAdditionalQuote: { permission: 'quotes.create', states: ['IN_PROGRESS'] },
  acceptQuote: { permission: 'quotes.accept.own', states: ['QUOTE_SENT', 'IN_PROGRESS'] },
  rejectQuote: { permission: 'quotes.reject.own', states: ['QUOTE_SENT', 'IN_PROGRESS'] },
  createPayment: { permission: 'payments.create', states: ['QUOTE_ACCEPTED', 'COMPLETED'] },
  confirmCash: { permission: 'payments.confirm.cash', states: ['COMPLETED'] },
  startTrip: { permission: 'jobs.start', states: ['CONFIRMED'] },
  arrive: { permission: 'jobs.arrive', states: ['ON_THE_WAY'] },
  startJob: { permission: 'jobs.start', states: ['ARRIVED'] },
  completeJob: { permission: 'jobs.complete', states: ['IN_PROGRESS'] },
  confirmCompletion: { permission: 'jobs.confirm.own', states: ['COMPLETION_PENDING'] },
  reportProblem: { permission: 'disputes.create', states: ['COMPLETION_PENDING'] },
  createReview: { permission: 'reviews.create', states: ['COMPLETED'] },
  verifyEngineer: { permission: 'engineers.verify' },
  suspendEngineer: { permission: 'engineers.suspend' },
  adminCancel: { permission: 'requests.manage' },
  updateSettings: { permission: 'platform.settings.manage' },
  refundPayment: { permission: 'payments.refund' },
};
