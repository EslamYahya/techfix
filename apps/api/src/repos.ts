import type {
  Candidate,
  PaymentMethod,
  PaymentStatus,
  CatalogSeedCategory,
  QuoteItemType,
  QuoteKind,
  QuoteStatus,
  RequestStatus,
} from '@techfix/domain';

export type Role = 'CUSTOMER' | 'ENGINEER' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'PENDING';
export type Verification = 'PENDING' | 'VERIFIED' | 'REJECTED';
export type Availability = 'AVAILABLE' | 'OFFLINE' | 'BUSY';

/** Storage ports. Two adapters: Prisma/PostgreSQL (production) and in-memory (tests, local dev). */
export const REPOS = Symbol('REPOS');

export interface UserRecord {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  passwordHash: string;
  role: Role;
  status: UserStatus;
  createdAt: Date;
}
export interface AccountRecord {
  user: UserRecord;
  customerId: string | null;
  engineerId: string | null;
  verification: Verification | null;
}
export interface CreateAccountInput {
  name: string;
  phone: string;
  email: string | null;
  passwordHash: string;
  role: Role;
  engineer?: { experienceYears: number; hasShop: boolean; serviceIds: string[] };
}
export interface IdentityRepo {
  findById(userId: string): Promise<AccountRecord | null>;
  findByLogin(login: { phone: string } | { email: string }): Promise<AccountRecord | null>;
  /** Throws DomainError('CONFLICT') when the phone or email is taken. */
  create(input: CreateAccountInput): Promise<AccountRecord>;
  updateUser(userId: string, patch: { name?: string; email?: string | null }): Promise<UserRecord>;
  setStatus(userId: string, status: UserStatus): Promise<void>;
}

export interface RefreshRecord {
  id: string;
  userId: string;
  familyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
}
export type ConsumeResult =
  | { status: 'ok'; record: RefreshRecord }
  | { status: 'reused'; record: RefreshRecord }
  | { status: 'unknown' };
export interface TokensRepo {
  insert(t: {
    userId: string;
    tokenHash: string;
    familyId: string;
    expiresAt: Date;
  }): Promise<void>;
  /** Atomically revokes a live token. A token that was already revoked is reported as `reused`. */
  consume(tokenHash: string, now: Date): Promise<ConsumeResult>;
  revokeFamily(familyId: string): Promise<void>;
  revokeAllForUser(userId: string): Promise<void>;
}

export interface CategoryView {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}
export interface ServiceView {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  category: CategoryView;
}
export interface CatalogRepo {
  listCategories(): Promise<CategoryView[]>;
  listServices(q: { categorySlug?: string; activeOnly: boolean }): Promise<ServiceView[]>;
  getService(id: string): Promise<ServiceView | null>;
  findServices(ids: string[]): Promise<ServiceView[]>;
  /** Throws CONFLICT on a duplicate slug and NOT_FOUND on an unknown category. */
  createService(s: {
    categoryId: string;
    name: string;
    slug: string;
    description: string | null;
  }): Promise<ServiceView>;
  updateService(
    id: string,
    patch: { name?: string; description?: string | null; isActive?: boolean },
  ): Promise<ServiceView | null>;
  /** Idempotent upsert by slug. */
  seed(data: readonly CatalogSeedCategory[]): Promise<void>;
}

export interface EngineerProfileRecord {
  id: string;
  userId: string;
  engineerType: 'FREELANCE' | 'SHOP_OWNER';
  bio: string | null;
  experienceYears: number;
  verificationStatus: Verification;
  rejectionReason: string | null;
  availabilityStatus: Availability;
  serviceRadiusKm: number;
  ratingAverage: number;
  ratingCount: number;
  completedJobsCount: number;
  createdAt: Date;
}
export interface LocationRecord {
  latitude: number;
  longitude: number;
  address: string | null;
  area: string | null;
}
export interface ScheduleSlot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}
export interface DocumentRecord {
  id: string;
  kind: string;
  approved: boolean | null;
  createdAt: Date;
}
export interface EngineerAggregate {
  profile: EngineerProfileRecord;
  user: { name: string; phone: string; email: string | null; status: UserStatus };
  services: ServiceView[];
  location: LocationRecord | null;
  schedule: ScheduleSlot[];
  documents: DocumentRecord[];
}
export interface AdminEngineerRow {
  id: string;
  userId: string;
  name: string;
  phone: string;
  accountStatus: UserStatus;
  verificationStatus: Verification;
  availabilityStatus: Availability;
  documentsCount: number;
  createdAt: Date;
}
export interface EngineersRepo {
  get(engineerId: string): Promise<EngineerAggregate | null>;
  updateProfile(
    engineerId: string,
    patch: {
      bio?: string | null;
      experienceYears?: number;
      serviceRadiusKm?: number;
      engineerType?: 'FREELANCE' | 'SHOP_OWNER';
    },
  ): Promise<void>;
  addDocument(engineerId: string, d: { kind: string; fileKey: string }): Promise<DocumentRecord>;
  setLocation(engineerId: string, loc: LocationRecord): Promise<void>;
  replaceSchedule(engineerId: string, slots: ScheduleSlot[]): Promise<void>;
  /** Throws CONFLICT when already added. */
  addService(engineerId: string, serviceId: string): Promise<void>;
  removeService(engineerId: string, serviceId: string): Promise<boolean>;
  setAvailability(engineerId: string, status: Availability): Promise<void>;
  setVerification(engineerId: string, status: Verification, reason: string | null): Promise<void>;
  list(q: {
    verification?: Verification;
    limit: number;
    cursor?: { t: string; id: string };
  }): Promise<{ items: AdminEngineerRow[]; next: { t: string; id: string } | null }>;
}

export interface AddressRecord {
  id: string;
  label: string;
  address: string;
  city: string | null;
  area: string | null;
  latitude: number;
  longitude: number;
  isDefault: boolean;
}
export interface CustomersRepo {
  listAddresses(customerId: string): Promise<AddressRecord[]>;
  addAddress(customerId: string, a: Omit<AddressRecord, 'id'>): Promise<AddressRecord>;
}

export interface AuditEntry {
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  requestId?: string | null;
  ip?: string | null;
}
export interface AuditRepo {
  record(e: AuditEntry): Promise<void>;
}

export type RequestStatusName = RequestStatus;
export type TimeSlotName = 'MORNING' | 'NOON' | 'EVENING';

export interface RequestLocationRecord {
  latitude: number;
  longitude: number;
  address: string;
  city: string | null;
  area: string | null;
}
export interface RequestRecord {
  id: string;
  number: number;
  customerId: string;
  serviceId: string;
  subService: string | null;
  description: string;
  preferredDate: string; // YYYY-MM-DD
  preferredSlot: TimeSlotName | null;
  preferredStartTime: string | null;
  preferredEndTime: string | null;
  status: RequestStatus;
  selectedEngineerId: string | null;
  cancelReason: string | null;
  version: number;
  createdAt: Date;
  location: RequestLocationRecord;
  attachmentKeys: string[];
}
export interface RequestEventRecord {
  at: Date;
  fromState: RequestStatus | null;
  toState: RequestStatus;
  actorRole: Role | 'SYSTEM';
  code: string;
}
export interface RequestAggregate {
  request: RequestRecord;
  service: ServiceView;
  customer: { name: string; phone: string };
  engineer: { id: string; name: string; phone: string; area: string | null } | null;
  events: RequestEventRecord[];
}
export interface CreateRequestInput {
  customerId: string;
  serviceId: string;
  subService: string | null;
  description: string;
  preferredDate: string;
  preferredSlot: TimeSlotName | null;
  preferredStartTime: string | null;
  preferredEndTime: string | null;
  location: RequestLocationRecord;
  attachmentKeys: string[];
}
export interface RequestChange {
  expectedVersion: number;
  from: RequestStatus;
  to: RequestStatus;
  /** undefined = keep, null = clear */
  selectedEngineerId?: string | null;
  cancel?: { reason: string | null; by: Role };
  /** Withdraws every SENT quote of the request (engineer replaced, request cancelled). */
  cancelOpenQuotes?: boolean;
  /** Stamps this moment on the request's job and mirrors the new status onto it. */
  jobStamp?: JobStamp;
  /** Remembers an engineer who must not be offered again for this request. */
  exclude?: { engineerId: string; reason: string | null; timedOut?: boolean };
  event: { code: string; actorId: string | null; actorRole: Role | 'SYSTEM' };
}
export interface MatchRow extends Candidate {
  name: string;
  area: string | null;
  ratingCount: number;
}
export interface RequestListQuery {
  status?: RequestStatus;
  limit: number;
  cursor?: { t: string; id: string };
}
export interface RequestsRepo {
  /** Creates the request in MATCHING and records REQUEST_CREATED. */
  create(input: CreateRequestInput): Promise<RequestRecord>;
  get(id: string): Promise<RequestAggregate | null>;
  listForCustomer(
    customerId: string,
    q: RequestListQuery,
  ): Promise<{ items: RequestAggregate[]; next: { t: string; id: string } | null }>;
  listForEngineer(
    engineerId: string,
    q: RequestListQuery,
  ): Promise<{ items: RequestAggregate[]; next: { t: string; id: string } | null }>;
  /** Optimistic lock: returns false when the request moved since it was read. Writes the timeline event atomically. */
  apply(id: string, change: RequestChange): Promise<boolean>;
  excludedEngineers(id: string): Promise<string[]>;
  /** Engineers of the service whose base location is within their own radius of the point (PostGIS in production). */
  matchCandidates(q: {
    serviceId: string;
    latitude: number;
    longitude: number;
  }): Promise<MatchRow[]>;
}

export type JobStamp =
  | 'confirmedAt'
  | 'startedTripAt'
  | 'arrivedAt'
  | 'startedAt'
  | 'completedAt'
  | 'confirmedByCustomerAt';
export interface QuoteItemRecord {
  type: QuoteItemType;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}
export interface QuoteRecord {
  id: string;
  requestId: string;
  engineerId: string;
  kind: QuoteKind;
  parentQuoteId: string | null;
  status: QuoteStatus;
  items: QuoteItemRecord[];
  subtotal: number;
  total: number;
  notes: string | null;
  estimatedDurationMinutes: number;
  rejectionReason: string | null;
  expiresAt: Date | null;
  sentAt: Date | null;
  decidedAt: Date | null;
  createdAt: Date;
}
export interface NewQuote {
  requestId: string;
  engineerId: string;
  kind: QuoteKind;
  parentQuoteId: string | null;
  items: QuoteItemRecord[];
  subtotal: number;
  total: number;
  notes: string | null;
  estimatedDurationMinutes: number;
  expiresAt: Date;
}
export interface JobRecord {
  id: string;
  requestId: string;
  quoteId: string;
  customerId: string;
  engineerId: string;
  status: RequestStatus;
  confirmedAt: Date | null;
  startedTripAt: Date | null;
  arrivedAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  confirmedByCustomerAt: Date | null;
  createdAt: Date;
}
/** Each write is one atomic business operation; `null` means the request moved or the quote was already decided. */
export interface QuotesRepo {
  list(requestId: string): Promise<QuoteRecord[]>;
  get(quoteId: string): Promise<QuoteRecord | null>;
  /** Creates a SENT main quote and applies the request change in one transaction. */
  sendMain(q: NewQuote, change: RequestChange): Promise<QuoteRecord | null>;
  /** Quote SENT→ACCEPTED, request change, and the Job is created — together. */
  acceptMain(quoteId: string, change: RequestChange): Promise<JobRecord | null>;
  rejectMain(quoteId: string, reason: string | null, change: RequestChange): Promise<boolean>;
  /** Throws PENDING_ADDITIONAL_QUOTE when one is already waiting; null when the request moved. */
  sendAdditional(q: NewQuote, expectedVersion: number): Promise<QuoteRecord | null>;
  decideAdditional(
    quoteId: string,
    status: 'ACCEPTED' | 'REJECTED',
    reason: string | null,
  ): Promise<boolean>;
}
export interface JobsRepo {
  get(jobId: string): Promise<JobRecord | null>;
  getByRequest(requestId: string): Promise<JobRecord | null>;
  openDispute(d: {
    jobId: string;
    userId: string;
    reason: string;
    description: string;
  }): Promise<{ id: string }>;
}

export interface PaymentRecord {
  id: string;
  jobId: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  provider: string | null;
  /** Provider's own reference for the order (Fawry: the number the customer pays with). */
  providerRef: string | null;
  failureReason: string | null;
  /** Total handed back so far (never more than `amount`). */
  refunded: number;
  paidAt: Date | null;
  confirmedBy: string | null;
  expiresAt: Date | null;
  createdAt: Date;
}
export interface NewPayment {
  jobId: string;
  amount: number;
  method: PaymentMethod;
  provider: string | null;
}
export interface WebhookRecord {
  id: string;
  /** True when this provider event was already processed (replay). */
  duplicate: boolean;
}
export interface SettleOutcome {
  status: 'PAID' | 'FAILED';
  providerRef?: string | null;
  failureReason?: string | null;
}
/** Each write is one atomic business operation (payment row + request change together). */
export interface PaymentsRepo {
  get(id: string): Promise<PaymentRecord | null>;
  listForJob(jobId: string): Promise<PaymentRecord[]>;
  /** ONLINE payments still PENDING that were created before `olderThan` (reconciliation input). */
  listPendingOnline(olderThan: Date): Promise<PaymentRecord[]>;
  /** Creates a PENDING payment. With `change`, the request change is applied in the same transaction; null when the request moved. */
  create(p: NewPayment, change?: RequestChange): Promise<PaymentRecord | null>;
  /** Stores what the provider returned for the order we created. */
  attachProvider(id: string, d: { providerRef: string; expiresAt: Date | null }): Promise<void>;
  /** Marks a not-yet-failed-for-good order failed (creation at the provider did not succeed). */
  discard(id: string, reason: string): Promise<void>;
  /** Stores the raw callback before anything else. `duplicate` = same (provider, externalId) already processed. */
  recordWebhook(e: {
    provider: string;
    externalId: string;
    payload: unknown;
    signatureOk: boolean;
  }): Promise<WebhookRecord>;
  finishWebhook(id: string, error: string | null): Promise<void>;
  /**
   * PENDING (or a FAILED one the provider later reports as paid) → PAID/FAILED, and the optional
   * request change, in ONE transaction. `settled` is false when somebody else settled it first;
   * `changed` is false when the request had moved and the change was skipped (the money is still recorded).
   */
  settle(
    id: string,
    outcome: SettleOutcome,
    change?: RequestChange,
  ): Promise<{ settled: boolean; changed: boolean }>;
  /** Cash payment PENDING → PAID with the amount actually due now. False when it was not pending. */
  confirmCash(id: string, d: { amount: number; engineerUserId: string }): Promise<boolean>;
}

export interface ReviewRecord {
  id: string;
  jobId: string;
  customerId: string;
  engineerId: string;
  rating: number;
  comment: string | null;
  isHidden: boolean;
  createdAt: Date;
  customerName: string;
}
export interface ReviewsRepo {
  getByJob(jobId: string): Promise<ReviewRecord | null>;
  /**
   * Inserts the review, applies the request change (COMPLETED→RATED) and recomputes the engineer's
   * rating aggregates — together. Null when the request moved; CONFLICT when the job already has a review.
   */
  create(
    r: {
      jobId: string;
      customerId: string;
      engineerId: string;
      rating: number;
      comment: string | null;
    },
    change: RequestChange,
  ): Promise<ReviewRecord | null>;
  listForEngineer(
    engineerId: string,
    q: { limit: number; cursor?: { t: string; id: string } },
  ): Promise<{ items: ReviewRecord[]; next: { t: string; id: string } | null }>;
}

export interface StoredResponse {
  bodyHash: string;
  code: number;
  body: unknown;
}
export interface IdempotencyRepo {
  find(userId: string, route: string, key: string): Promise<StoredResponse | null>;
  /** First writer wins; a concurrent duplicate is ignored. */
  save(
    userId: string,
    route: string,
    key: string,
    r: StoredResponse,
    ttlHours: number,
  ): Promise<void>;
}

// ───────────── Notifications + outbox (phase 5) ─────────────
export interface NotificationRecord {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  readAt: Date | null;
  createdAt: Date;
}
export interface NewNotification {
  userId: string;
  type: string;
  title: string;
  body: string;
  /** `eventId` inside makes the insert idempotent per (user, event): a retried dispatch cannot double-notify. */
  data: Record<string, unknown> & { eventId: string };
}
export interface NotificationsRepo {
  /** User ids of the two sides of a request (the engineer only once one is selected). */
  recipientsOf(
    requestId: string,
    engineerProfileId?: string | null,
  ): Promise<{
    customerUserId: string;
    engineerUserId: string | null;
  } | null>;
  /** Users who hold the platform-staff role (receive operational alerts). */
  adminUserIds(): Promise<string[]>;
  createOnce(n: NewNotification): Promise<boolean>;
  list(
    userId: string,
    q: { unread?: boolean; limit: number; cursor?: { t: string; id: string } },
  ): Promise<NotificationRecord[]>;
  unreadCount(userId: string): Promise<number>;
  markRead(userId: string, id: string): Promise<boolean>;
  markAllRead(userId: string): Promise<void>;
  saveDevice(userId: string, d: { token: string; platform: string }): Promise<void>;
}

export interface OutboxRow {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  attempts: number;
}
export interface OutboxRepo {
  enqueue(type: string, payload: Record<string, unknown>): Promise<string>;
  /**
   * Hands out due, unpublished rows and pushes their next attempt `leaseSeconds` ahead, so two
   * workers never take the same row at the same time (FOR UPDATE SKIP LOCKED on PostgreSQL).
   */
  lease(limit: number, leaseSeconds: number): Promise<OutboxRow[]>;
  get(id: string): Promise<OutboxRow | null>;
  markPublished(id: string): Promise<void>;
  /** Failed attempt: retry later with backoff (the lease already counted the attempt). */
  retryLater(id: string, delaySeconds: number): Promise<void>;
  backlog(): Promise<number>;
}

// ───────────── Admin back office (phase 6) ─────────────
export type DisputeStatusName = 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'REJECTED';
export interface AdminPage<T> {
  items: T[];
  next: { t: string; id: string } | null;
}
export interface AdminListQuery {
  limit: number;
  cursor?: { t: string; id: string };
}
export interface AdminRequestRow {
  id: string;
  number: number;
  status: RequestStatus;
  serviceName: string;
  customerName: string;
  engineerName: string | null;
  hasDispute: boolean;
  createdAt: Date;
}
export interface AdminPaymentRow extends PaymentRecord {
  requestId: string;
  requestNumber: number;
  customerName: string;
  engineerName: string | null;
}
export interface PaymentTotals {
  /** Money actually kept: paid minus refunded. */
  collectedNet: number;
  cashNet: number;
  onlineNet: number;
  refundedTotal: number;
  pendingCount: number;
  pendingAmount: number;
}
export interface DisputeRow {
  id: string;
  jobId: string;
  requestId: string;
  requestNumber: number;
  openedByUserId: string;
  openedByName: string;
  openedByRole: Role;
  reason: string;
  description: string;
  status: DisputeStatusName;
  resolution: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
}
export interface AdminReviewRow extends ReviewRecord {
  engineerName: string;
  requestNumber: number;
}
export interface RefundRecord {
  id: string;
  paymentId: string;
  amount: number;
  reason: string;
  createdAt: Date;
}
export interface AdminRepo {
  listRequests(
    q: AdminListQuery & { status?: RequestStatus; hasDispute?: boolean },
  ): Promise<AdminPage<AdminRequestRow>>;
  listPayments(
    q: AdminListQuery & { status?: PaymentStatus; method?: PaymentMethod },
  ): Promise<AdminPage<AdminPaymentRow>>;
  paymentTotals(): Promise<PaymentTotals>;
  /**
   * Records a refund against a PAID / PARTIALLY_REFUNDED payment and moves it to PARTIALLY_REFUNDED or
   * REFUNDED — one transaction. `rejected` when the amount exceeds what is left (concurrent refunds).
   */
  refund(
    paymentId: string,
    d: { amount: number; reason: string; adminId: string },
  ): Promise<{ ok: true; refund: RefundRecord; payment: PaymentRecord } | { ok: false }>;
  listDisputes(q: AdminListQuery & { status?: DisputeStatusName }): Promise<AdminPage<DisputeRow>>;
  getDispute(id: string): Promise<DisputeRow | null>;
  /** OPEN/UNDER_REVIEW → RESOLVED/REJECTED. False when it was already closed. */
  resolveDispute(
    id: string,
    d: { status: 'RESOLVED' | 'REJECTED'; resolution: string; adminId: string },
  ): Promise<boolean>;
  listReviews(q: AdminListQuery & { hidden?: boolean }): Promise<AdminPage<AdminReviewRow>>;
  getReview(id: string): Promise<AdminReviewRow | null>;
  /** Hides/unhides and recomputes the engineer's average and count from the visible ones — together. */
  setReviewHidden(id: string, hidden: boolean): Promise<AdminReviewRow | null>;
}

export interface Repos {
  identity: IdentityRepo;
  tokens: TokensRepo;
  catalog: CatalogRepo;
  engineers: EngineersRepo;
  customers: CustomersRepo;
  audit: AuditRepo;
  requests: RequestsRepo;
  quotes: QuotesRepo;
  jobs: JobsRepo;
  payments: PaymentsRepo;
  reviews: ReviewsRepo;
  idempotency: IdempotencyRepo;
  notifications: NotificationsRepo;
  outbox: OutboxRepo;
  admin: AdminRepo;
  close(): Promise<void>;
}
