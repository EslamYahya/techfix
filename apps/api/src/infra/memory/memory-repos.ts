import { randomUUID } from 'node:crypto';
import {
  DomainError,
  ratingAverage,
  round2,
  type CatalogSeedCategory,
  type RequestStatus,
} from '@techfix/domain';
import type {
  AdminPaymentRow,
  AdminReviewRow,
  DisputeRow,
  DisputeStatusName,
  RefundRecord,
  NotificationRecord,
  OutboxRow,
  AddressRecord,
  AdminEngineerRow,
  AuditEntry,
  CategoryView,
  ConsumeResult,
  DocumentRecord,
  EngineerAggregate,
  EngineerProfileRecord,
  LocationRecord,
  JobRecord,
  MatchRow,
  NewQuote,
  QuoteRecord,
  RefreshRecord,
  RequestChange,
  RequestAggregate,
  RequestEventRecord,
  RequestRecord,
  Repos,
  ScheduleSlot,
  ServiceView,
  UserRecord,
  AccountRecord,
  PaymentRecord,
  ReviewRecord,
  StoredResponse,
} from '../../repos.js';

interface ServiceRow {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
}

/** In-memory adapter: same behaviour as the Prisma adapter, used by tests and `STORE=memory` local dev. */
export function createMemoryRepos(): Repos & { audits: AuditEntry[] } {
  const users = new Map<string, UserRecord>();
  const customers = new Map<string, { id: string; userId: string }>();
  const engineers = new Map<string, EngineerProfileRecord>();
  const engServices = new Map<string, Set<string>>();
  const locations = new Map<string, LocationRecord>();
  const schedules = new Map<string, ScheduleSlot[]>();
  const documents = new Map<string, DocumentRecord[]>();
  const addresses = new Map<string, AddressRecord[]>();
  const categories = new Map<string, CategoryView>();
  const services = new Map<string, ServiceRow>();
  const tokens = new Map<string, RefreshRecord & { tokenHash: string }>();
  const audits: AuditEntry[] = [];
  const reqs = new Map<string, RequestRecord>();
  const reqEvents = new Map<string, RequestEventRecord[]>();
  const reqExcluded = new Map<string, Set<string>>();
  let reqNumber = 1000;
  const quotes = new Map<string, QuoteRecord>();
  const jobs = new Map<string, JobRecord>();
  const disputes: {
    id: string;
    jobId: string;
    openedByUserId: string;
    reason: string;
    description: string;
    status: DisputeStatusName;
    resolution: string | null;
    resolvedAt: Date | null;
    createdAt: Date;
  }[] = [];
  const refunds: RefundRecord[] = [];
  const payments = new Map<string, PaymentRecord>();
  const webhooks = new Map<string, { id: string; processed: boolean }>();
  const reviews = new Map<string, ReviewRecord>();
  const idem = new Map<string, StoredResponse & { expiresAt: number }>();
  const notes = new Map<string, NotificationRecord>();
  const devices = new Map<string, { userId: string; platform: string }>();
  const outboxRows = new Map<
    string,
    OutboxRow & { nextRunAt: number; publishedAt: number | null }
  >();
  const applyReq = (id: string, c: RequestChange): boolean => {
    const r = reqs.get(id);
    if (!r || r.version !== c.expectedVersion || r.status !== c.from) return false;
    reqs.set(id, {
      ...r,
      status: c.to,
      version: r.version + 1,
      selectedEngineerId:
        c.selectedEngineerId === undefined ? r.selectedEngineerId : c.selectedEngineerId,
      cancelReason: c.cancel ? c.cancel.reason : r.cancelReason,
    });
    if (c.exclude) {
      const set = reqExcluded.get(id) ?? new Set<string>();
      set.add(c.exclude.engineerId);
      reqExcluded.set(id, set);
    }
    if (c.cancelOpenQuotes)
      for (const q of quotes.values())
        if (q.requestId === id && q.status === 'SENT')
          quotes.set(q.id, { ...q, status: 'CANCELLED', decidedAt: new Date() });
    const job = [...jobs.values()].find((j) => j.requestId === id);
    if (job)
      jobs.set(job.id, {
        ...job,
        status: c.to,
        ...(c.jobStamp ? { [c.jobStamp]: new Date() } : {}),
      });
    reqEvents.set(id, [
      ...(reqEvents.get(id) ?? []),
      {
        at: new Date(),
        fromState: c.from,
        toState: c.to,
        actorRole: c.event.actorRole,
        code: c.event.code,
      },
    ]);
    return true;
  };
  const newQuote = (q: NewQuote, status: QuoteRecord['status']): QuoteRecord => {
    const rec: QuoteRecord = {
      id: randomUUID(),
      requestId: q.requestId,
      engineerId: q.engineerId,
      kind: q.kind,
      parentQuoteId: q.parentQuoteId,
      status,
      items: q.items.map((i) => ({ ...i })),
      subtotal: q.subtotal,
      total: q.total,
      notes: q.notes,
      estimatedDurationMinutes: q.estimatedDurationMinutes,
      rejectionReason: null,
      expiresAt: q.expiresAt,
      sentAt: new Date(),
      decidedAt: null,
      createdAt: new Date(),
    };
    quotes.set(rec.id, rec);
    return rec;
  };
  const km = (la1: number, lo1: number, la2: number, lo2: number) => {
    const r = (d: number) => (d * Math.PI) / 180;
    const a =
      Math.sin(r(la2 - la1) / 2) ** 2 +
      Math.cos(r(la1)) * Math.cos(r(la2)) * Math.sin(r(lo2 - lo1) / 2) ** 2;
    return 6371.0088 * 2 * Math.asin(Math.sqrt(a));
  };
  const aggregate = (r: RequestRecord): RequestAggregate => {
    const cust = [...customers.values()].find((c) => c.id === r.customerId)!;
    const cu = users.get(cust.userId)!;
    const eng = r.selectedEngineerId ? engineers.get(r.selectedEngineerId) : undefined;
    const eu = eng ? users.get(eng.userId)! : undefined;
    return {
      request: { ...r },
      service: view(services.get(r.serviceId)!),
      customer: { name: cu.name, phone: cu.phone },
      engineer:
        eng && eu
          ? {
              id: eng.id,
              name: eu.name,
              phone: eu.phone,
              area: locations.get(eng.id)?.area ?? null,
            }
          : null,
      events: [...(reqEvents.get(r.id) ?? [])],
    };
  };
  /** Newest first, keyset-paged like every other list: one extra row says there is a next page. */
  function pageOf<R extends { id: string; createdAt: Date }, T>(
    rows: R[],
    q: { limit: number; cursor?: { t: string; id: string } },
    key: (r: R) => R,
    map: (r: R) => T,
  ): { items: T[]; next: { t: string; id: string } | null } {
    const sorted = rows
      .map(key)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? 1 : -1))
      .filter(
        (r) =>
          !q.cursor ||
          r.createdAt.toISOString() < q.cursor.t ||
          (r.createdAt.toISOString() === q.cursor.t && r.id < q.cursor.id),
      );
    const items = sorted.slice(0, q.limit);
    const last = items.at(-1);
    return {
      items: items.map(map),
      next:
        sorted.length > q.limit && last ? { t: last.createdAt.toISOString(), id: last.id } : null,
    };
  }
  const userName = (id: string | undefined) => (id ? (users.get(id)?.name ?? '') : '');
  const customerNameOf = (profileId: string) =>
    userName([...customers.values()].find((c) => c.id === profileId)?.userId);
  const engineerNameOf = (profileId: string | null | undefined) =>
    profileId ? userName(engineers.get(profileId)?.userId) : null;
  const paymentRow = (p: PaymentRecord): AdminPaymentRow => {
    const job = jobs.get(p.jobId)!;
    return {
      ...p,
      requestId: job.requestId,
      requestNumber: reqs.get(job.requestId)?.number ?? 0,
      customerName: customerNameOf(job.customerId),
      engineerName: engineerNameOf(job.engineerId),
    };
  };
  const disputeRow = (d: (typeof disputes)[number]): DisputeRow => {
    const job = jobs.get(d.jobId)!;
    const opener = users.get(d.openedByUserId);
    return {
      ...d,
      requestId: job.requestId,
      requestNumber: reqs.get(job.requestId)?.number ?? 0,
      openedByName: opener?.name ?? '',
      openedByRole: opener?.role ?? 'CUSTOMER',
    };
  };
  const reviewRow = (r: ReviewRecord): AdminReviewRow => {
    const job = jobs.get(r.jobId);
    return {
      ...r,
      engineerName: engineerNameOf(r.engineerId) ?? '',
      requestNumber: (job && reqs.get(job.requestId)?.number) ?? 0,
    };
  };
  const page = (
    rows: RequestRecord[],
    q: { status?: RequestStatus; limit: number; cursor?: { t: string; id: string } },
  ) => {
    const sorted = rows
      .filter((r) => !q.status || r.status === q.status)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? 1 : -1))
      .filter(
        (r) =>
          !q.cursor ||
          r.createdAt.toISOString() < q.cursor.t ||
          (r.createdAt.toISOString() === q.cursor.t && r.id < q.cursor.id),
      );
    const items = sorted.slice(0, q.limit);
    const last = items.at(-1);
    return {
      items: items.map(aggregate),
      next:
        sorted.length > q.limit && last ? { t: last.createdAt.toISOString(), id: last.id } : null,
    };
  };

  const view = (s: ServiceRow): ServiceView => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
    description: s.description,
    isActive: s.isActive,
    category: categories.get(s.categoryId)!,
  });
  const account = (u: UserRecord): AccountRecord => {
    const c = [...customers.values()].find((x) => x.userId === u.id);
    const e = [...engineers.values()].find((x) => x.userId === u.id);
    return {
      user: u,
      customerId: c?.id ?? null,
      engineerId: e?.id ?? null,
      verification: e?.verificationStatus ?? null,
    };
  };

  return {
    audits,
    identity: {
      async findById(id) {
        const u = users.get(id);
        return u ? account(u) : null;
      },
      async findByLogin(login) {
        const u = [...users.values()].find((x) =>
          'phone' in login ? x.phone === login.phone : x.email === login.email,
        );
        return u ? account(u) : null;
      },
      async create(input) {
        const taken = [...users.values()].some(
          (u) => u.phone === input.phone || (input.email !== null && u.email === input.email),
        );
        if (taken) throw new DomainError('CONFLICT', 'Phone or email already registered');
        const user: UserRecord = {
          id: randomUUID(),
          name: input.name,
          email: input.email,
          phone: input.phone,
          passwordHash: input.passwordHash,
          role: input.role,
          status: 'ACTIVE',
          createdAt: new Date(),
        };
        users.set(user.id, user);
        if (input.role === 'CUSTOMER')
          customers.set(user.id, { id: randomUUID(), userId: user.id });
        if (input.role === 'ENGINEER' && input.engineer) {
          const id = randomUUID();
          engineers.set(id, {
            id,
            userId: user.id,
            engineerType: input.engineer.hasShop ? 'SHOP_OWNER' : 'FREELANCE',
            bio: null,
            experienceYears: input.engineer.experienceYears,
            verificationStatus: 'PENDING',
            rejectionReason: null,
            availabilityStatus: 'OFFLINE',
            serviceRadiusKm: 15,
            ratingAverage: 0,
            ratingCount: 0,
            completedJobsCount: 0,
            createdAt: new Date(),
          });
          engServices.set(id, new Set(input.engineer.serviceIds));
        }
        return account(user);
      },
      async updateUser(id, patch) {
        const u = users.get(id)!;
        if (patch.email && [...users.values()].some((x) => x.id !== id && x.email === patch.email))
          throw new DomainError('CONFLICT', 'Email already registered');
        const next = { ...u, ...('name' in patch && patch.name ? { name: patch.name } : {}) };
        if ('email' in patch) next.email = patch.email ?? null;
        users.set(id, next);
        return next;
      },
      async setStatus(id, status) {
        const u = users.get(id);
        if (u) users.set(id, { ...u, status });
      },
    },
    tokens: {
      async insert(t) {
        tokens.set(t.tokenHash, { id: randomUUID(), revokedAt: null, ...t });
      },
      async consume(hash, now): Promise<ConsumeResult> {
        const t = tokens.get(hash);
        if (!t) return { status: 'unknown' };
        if (t.revokedAt) return { status: 'reused', record: t };
        if (t.expiresAt <= now) return { status: 'unknown' };
        t.revokedAt = now;
        return { status: 'ok', record: t };
      },
      async revokeFamily(familyId) {
        for (const t of tokens.values())
          if (t.familyId === familyId && !t.revokedAt) t.revokedAt = new Date();
      },
      async revokeAllForUser(userId) {
        for (const t of tokens.values())
          if (t.userId === userId && !t.revokedAt) t.revokedAt = new Date();
      },
    },
    catalog: {
      async listCategories() {
        return [...categories.values()];
      },
      async listServices({ categorySlug, activeOnly }) {
        return [...services.values()]
          .filter(
            (s) =>
              (!activeOnly || s.isActive) &&
              (!categorySlug || categories.get(s.categoryId)?.slug === categorySlug),
          )
          .map(view);
      },
      async getService(id) {
        const s = services.get(id);
        return s ? view(s) : null;
      },
      async findServices(ids) {
        return ids.flatMap((id) => (services.has(id) ? [view(services.get(id)!)] : []));
      },
      async createService(s) {
        if (!categories.has(s.categoryId)) throw new DomainError('NOT_FOUND', 'Category not found');
        if ([...services.values()].some((x) => x.slug === s.slug))
          throw new DomainError('CONFLICT', 'Slug taken');
        const row: ServiceRow = { id: randomUUID(), isActive: true, ...s };
        services.set(row.id, row);
        return view(row);
      },
      async updateService(id, patch) {
        const s = services.get(id);
        if (!s) return null;
        const next = { ...s, ...patch };
        services.set(id, next);
        return view(next);
      },
      async seed(data: readonly CatalogSeedCategory[]) {
        for (const c of data) {
          let cat = [...categories.values()].find((x) => x.slug === c.slug);
          if (!cat) {
            cat = { id: randomUUID(), name: c.name, slug: c.slug, description: c.description };
            categories.set(cat.id, cat);
          }
          for (const s of c.services) {
            if ([...services.values()].some((x) => x.slug === s.slug)) continue;
            const row: ServiceRow = {
              id: randomUUID(),
              categoryId: cat.id,
              name: s.name,
              slug: s.slug,
              description: null,
              isActive: true,
            };
            services.set(row.id, row);
          }
        }
      },
    },
    engineers: {
      async get(id): Promise<EngineerAggregate | null> {
        const p = engineers.get(id);
        if (!p) return null;
        const u = users.get(p.userId)!;
        return {
          profile: p,
          user: { name: u.name, phone: u.phone, email: u.email, status: u.status },
          services: [...(engServices.get(id) ?? [])].flatMap((sid) =>
            services.has(sid) ? [view(services.get(sid)!)] : [],
          ),
          location: locations.get(id) ?? null,
          schedule: schedules.get(id) ?? [],
          documents: documents.get(id) ?? [],
        };
      },
      async updateProfile(id, patch) {
        const p = engineers.get(id)!;
        engineers.set(id, { ...p, ...patch });
      },
      async addDocument(id, d) {
        const rec: DocumentRecord = {
          id: randomUUID(),
          kind: d.kind,
          approved: null,
          createdAt: new Date(),
        };
        documents.set(id, [...(documents.get(id) ?? []), rec]);
        return rec;
      },
      async setLocation(id, loc) {
        locations.set(id, loc);
      },
      async replaceSchedule(id, slots) {
        schedules.set(id, slots);
      },
      async addService(id, serviceId) {
        const set = engServices.get(id) ?? new Set<string>();
        if (set.has(serviceId)) throw new DomainError('CONFLICT', 'Already added');
        set.add(serviceId);
        engServices.set(id, set);
      },
      async removeService(id, serviceId) {
        return engServices.get(id)?.delete(serviceId) ?? false;
      },
      async setAvailability(id, status) {
        const p = engineers.get(id)!;
        engineers.set(id, { ...p, availabilityStatus: status });
      },
      async setVerification(id, status, reason) {
        const p = engineers.get(id)!;
        engineers.set(id, { ...p, verificationStatus: status, rejectionReason: reason });
      },
      async list({ verification, limit, cursor }) {
        const rows = [...engineers.values()]
          .filter((p) => !verification || p.verificationStatus === verification)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? 1 : -1))
          .filter(
            (p) =>
              !cursor ||
              p.createdAt.toISOString() < cursor.t ||
              (p.createdAt.toISOString() === cursor.t && p.id < cursor.id),
          );
        const page = rows.slice(0, limit);
        const last = page.at(-1);
        const items: AdminEngineerRow[] = page.map((p) => {
          const u = users.get(p.userId)!;
          return {
            id: p.id,
            userId: p.userId,
            name: u.name,
            phone: u.phone,
            accountStatus: u.status,
            verificationStatus: p.verificationStatus,
            availabilityStatus: p.availabilityStatus,
            documentsCount: documents.get(p.id)?.length ?? 0,
            createdAt: p.createdAt,
          };
        });
        return {
          items,
          next:
            rows.length > limit && last ? { t: last.createdAt.toISOString(), id: last.id } : null,
        };
      },
    },
    customers: {
      async listAddresses(cid) {
        return addresses.get(cid) ?? [];
      },
      async addAddress(cid, a) {
        const list = addresses.get(cid) ?? [];
        const isDefault = a.isDefault || list.length === 0;
        const rec: AddressRecord = { id: randomUUID(), ...a, isDefault };
        const next = [...(isDefault ? list.map((x) => ({ ...x, isDefault: false })) : list), rec];
        addresses.set(cid, next);
        return rec;
      },
    },
    requests: {
      async create(input) {
        const id = randomUUID();
        const now = new Date();
        const rec: RequestRecord = {
          id,
          number: ++reqNumber,
          customerId: input.customerId,
          serviceId: input.serviceId,
          subService: input.subService,
          description: input.description,
          preferredDate: input.preferredDate,
          preferredSlot: input.preferredSlot,
          preferredStartTime: input.preferredStartTime,
          preferredEndTime: input.preferredEndTime,
          status: 'MATCHING',
          selectedEngineerId: null,
          cancelReason: null,
          version: 0,
          createdAt: now,
          location: { ...input.location },
          attachmentKeys: [...input.attachmentKeys],
        };
        reqs.set(id, rec);
        reqEvents.set(id, [
          {
            at: now,
            fromState: 'REQUESTED',
            toState: 'MATCHING',
            actorRole: 'CUSTOMER',
            code: 'REQUEST_CREATED',
          },
        ]);
        return { ...rec };
      },
      async get(id) {
        const r = reqs.get(id);
        return r ? aggregate(r) : null;
      },
      async listForCustomer(customerId, q) {
        return page(
          [...reqs.values()].filter((r) => r.customerId === customerId),
          q,
        );
      },
      async listForEngineer(engineerId, q) {
        return page(
          [...reqs.values()].filter((r) => r.selectedEngineerId === engineerId),
          q,
        );
      },
      async apply(id, c) {
        return applyReq(id, c);
      },
      async excludedEngineers(id) {
        return [...(reqExcluded.get(id) ?? [])];
      },
      async matchCandidates({ serviceId, latitude, longitude }) {
        const out: MatchRow[] = [];
        for (const e of engineers.values()) {
          const loc = locations.get(e.id);
          if (!loc || !engServices.get(e.id)?.has(serviceId)) continue;
          const u = users.get(e.userId)!;
          out.push({
            engineerId: e.id,
            accountActive: u.status === 'ACTIVE',
            verified: e.verificationStatus === 'VERIFIED',
            serviceIds: [serviceId],
            subServices: null,
            availability: e.availabilityStatus,
            serviceRadiusKm: e.serviceRadiusKm,
            distanceKm: km(latitude, longitude, loc.latitude, loc.longitude),
            ratingAverage: e.ratingAverage,
            experienceYears: e.experienceYears,
            completedJobs: e.completedJobsCount,
            name: u.name,
            area: loc.area,
            ratingCount: e.ratingCount,
          });
        }
        return out;
      },
    },
    quotes: {
      async list(requestId) {
        return [...quotes.values()]
          .filter((q) => q.requestId === requestId)
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      },
      async get(id) {
        return quotes.get(id) ?? null;
      },
      /** Test seam: move a quote's validity into the past without going through the service. */
      async expire(id, expiresAt) {
        const q = quotes.get(id);
        if (!q) return;
        quotes.set(id, { ...q, expiresAt });
      },
      async sendMain(q, change) {
        const r = reqs.get(q.requestId);
        if (!r || r.version !== change.expectedVersion || r.status !== change.from) return null;
        const rec = newQuote(q, 'SENT');
        applyReq(q.requestId, change);
        return rec;
      },
      async acceptMain(quoteId, change) {
        const q = quotes.get(quoteId);
        if (!q || q.status !== 'SENT') return null;
        // Same rule as the PostgreSQL adapter: a quote whose validity passed is not acceptable, and
        // the check must look at the stored row, not a caller's earlier copy of it.
        if (q.expiresAt && q.expiresAt.getTime() < Date.now()) return null;
        const r = reqs.get(q.requestId);
        if (!r || !applyReq(q.requestId, change)) return null;
        quotes.set(q.id, { ...q, status: 'ACCEPTED', decidedAt: new Date() });
        const job: JobRecord = {
          id: randomUUID(),
          requestId: q.requestId,
          quoteId: q.id,
          customerId: r.customerId,
          engineerId: q.engineerId,
          status: change.to,
          confirmedAt: null,
          startedTripAt: null,
          arrivedAt: null,
          startedAt: null,
          completedAt: null,
          confirmedByCustomerAt: null,
          createdAt: new Date(),
        };
        jobs.set(job.id, job);
        return { ...job };
      },
      async rejectMain(quoteId, reason, change) {
        const q = quotes.get(quoteId);
        if (!q || q.status !== 'SENT' || !applyReq(q.requestId, change)) return false;
        quotes.set(q.id, {
          ...q,
          status: 'REJECTED',
          rejectionReason: reason,
          decidedAt: new Date(),
        });
        return true;
      },
      async sendAdditional(q, expectedVersion) {
        const r = reqs.get(q.requestId);
        if (!r || r.version !== expectedVersion) return null;
        if (
          [...quotes.values()].some(
            (x) => x.requestId === q.requestId && x.kind === 'ADDITIONAL' && x.status === 'SENT',
          )
        )
          throw new DomainError('PENDING_ADDITIONAL_QUOTE');
        return newQuote(q, 'SENT');
      },
      async decideAdditional(quoteId, status, reason) {
        const q = quotes.get(quoteId);
        if (!q || q.kind !== 'ADDITIONAL' || q.status !== 'SENT') return false;
        quotes.set(q.id, { ...q, status, rejectionReason: reason, decidedAt: new Date() });
        return true;
      },
    },
    jobs: {
      async get(id) {
        const j = jobs.get(id);
        return j ? { ...j } : null;
      },
      async getByRequest(requestId) {
        const j = [...jobs.values()].find((x) => x.requestId === requestId);
        return j ? { ...j } : null;
      },
      async openDispute(d) {
        const rec = {
          id: randomUUID(),
          jobId: d.jobId,
          openedByUserId: d.userId,
          reason: d.reason,
          description: d.description,
          status: 'OPEN' as DisputeStatusName,
          resolution: null,
          resolvedAt: null,
          createdAt: new Date(),
        };
        disputes.push(rec);
        return { id: rec.id };
      },
    },
    payments: {
      async get(id) {
        const p = payments.get(id);
        return p ? { ...p } : null;
      },
      async listForJob(jobId) {
        return [...payments.values()]
          .filter((p) => p.jobId === jobId)
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
          .map((p) => ({ ...p }));
      },
      async listPendingOnline(olderThan) {
        return [...payments.values()]
          .filter(
            (p) =>
              p.method === 'ONLINE' &&
              p.status === 'PENDING' &&
              p.providerRef !== null &&
              p.createdAt < olderThan,
          )
          .map((p) => ({ ...p }));
      },
      async create(np, change) {
        const job = jobs.get(np.jobId);
        if (!job) return null;
        if (change && !applyReq(job.requestId, change)) return null;
        const rec: PaymentRecord = {
          id: randomUUID(),
          jobId: np.jobId,
          amount: np.amount,
          method: np.method,
          status: 'PENDING',
          provider: np.provider,
          providerRef: null,
          failureReason: null,
          refunded: 0,
          paidAt: null,
          confirmedBy: null,
          expiresAt: null,
          createdAt: new Date(),
        };
        payments.set(rec.id, rec);
        return { ...rec };
      },
      async attachProvider(id, d) {
        const p = payments.get(id);
        if (p) payments.set(id, { ...p, providerRef: d.providerRef, expiresAt: d.expiresAt });
      },
      async discard(id, reason) {
        const p = payments.get(id);
        if (p && p.status === 'PENDING')
          payments.set(id, { ...p, status: 'FAILED', failureReason: reason });
      },
      async recordWebhook(e) {
        const key = `${e.provider}:${e.externalId}`;
        const seen = webhooks.get(key);
        if (seen) return { id: seen.id, duplicate: seen.processed };
        const rec = { id: randomUUID(), processed: false };
        webhooks.set(key, rec);
        return { id: rec.id, duplicate: false };
      },
      async finishWebhook(id, _error) {
        for (const w of webhooks.values()) if (w.id === id) w.processed = true;
      },
      async settle(id, outcome, change) {
        const p = payments.get(id);
        const ok =
          p && (p.status === 'PENDING' || (p.status === 'FAILED' && outcome.status === 'PAID'));
        if (!p || !ok) return { settled: false, changed: false };
        payments.set(id, {
          ...p,
          status: outcome.status,
          providerRef: outcome.providerRef ?? p.providerRef,
          failureReason: outcome.status === 'FAILED' ? (outcome.failureReason ?? null) : null,
          paidAt: outcome.status === 'PAID' ? new Date() : null,
        });
        const job = jobs.get(p.jobId);
        const changed = !!(change && job && applyReq(job.requestId, change));
        return { settled: true, changed };
      },
      async confirmCash(id, d) {
        const p = payments.get(id);
        if (!p || p.method !== 'CASH' || p.status !== 'PENDING') return false;
        payments.set(id, {
          ...p,
          amount: d.amount,
          status: 'PAID',
          paidAt: new Date(),
          confirmedBy: d.engineerUserId,
        });
        return true;
      },
    },
    reviews: {
      async getByJob(jobId) {
        const r = [...reviews.values()].find((x) => x.jobId === jobId);
        return r ? { ...r } : null;
      },
      async create(r, change) {
        if ([...reviews.values()].some((x) => x.jobId === r.jobId))
          throw new DomainError('CONFLICT');
        const job = jobs.get(r.jobId);
        if (!job || !applyReq(job.requestId, change)) return null;
        const cust = [...customers.values()].find((c) => c.id === r.customerId);
        const rec: ReviewRecord = {
          id: randomUUID(),
          ...r,
          isHidden: false,
          createdAt: new Date(),
          customerName: (cust && users.get(cust.userId)?.name) || '',
        };
        reviews.set(rec.id, rec);
        const mine = [...reviews.values()].filter(
          (x) => x.engineerId === r.engineerId && !x.isHidden,
        );
        const prof = engineers.get(r.engineerId);
        if (prof)
          engineers.set(r.engineerId, {
            ...prof,
            ratingAverage: ratingAverage(mine.map((x) => x.rating)),
            ratingCount: mine.length,
          });
        return { ...rec };
      },
      async listForEngineer(engineerId, q) {
        const all = [...reviews.values()]
          .filter((r) => r.engineerId === engineerId && !r.isHidden)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? 1 : -1));
        const start = q.cursor ? all.findIndex((r) => r.id === q.cursor!.id) + 1 : 0;
        const items = all.slice(start, start + q.limit);
        const last = items.at(-1);
        return {
          items: items.map((r) => ({ ...r })),
          next:
            start + q.limit < all.length && last
              ? { t: last.createdAt.toISOString(), id: last.id }
              : null,
        };
      },
    },
    notifications: {
      async recipientsOf(requestId, engineerProfileId) {
        const r = reqs.get(requestId);
        if (!r) return null;
        const cust = [...customers.values()].find((c) => c.id === r.customerId);
        if (!cust) return null;
        const engId = engineerProfileId ?? r.selectedEngineerId;
        const eng = engId ? engineers.get(engId) : undefined;
        return { customerUserId: cust.userId, engineerUserId: eng?.userId ?? null };
      },
      async adminUserIds() {
        return [...users.values()].filter((u) => u.role === 'ADMIN').map((u) => u.id);
      },
      async createOnce(n) {
        const dup = [...notes.values()].some(
          (x) => x.userId === n.userId && x.data?.['eventId'] === n.data.eventId,
        );
        if (dup) return false;
        const id = randomUUID();
        notes.set(id, {
          id,
          userId: n.userId,
          type: n.type,
          title: n.title,
          body: n.body,
          data: n.data,
          readAt: null,
          createdAt: new Date(),
        });
        return true;
      },
      async list(userId, q) {
        const all = [...notes.values()]
          .filter((x) => x.userId === userId && (!q.unread || x.readAt === null))
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? 1 : -1));
        const start = q.cursor ? all.findIndex((x) => x.id === q.cursor!.id) + 1 : 0;
        return all.slice(start, start + q.limit + 1).map((x) => ({ ...x }));
      },
      async unreadCount(userId) {
        return [...notes.values()].filter((x) => x.userId === userId && x.readAt === null).length;
      },
      async markRead(userId, id) {
        const n = notes.get(id);
        if (!n || n.userId !== userId) return false;
        if (!n.readAt) notes.set(id, { ...n, readAt: new Date() });
        return true;
      },
      async markAllRead(userId) {
        for (const [id, n] of notes)
          if (n.userId === userId && !n.readAt) notes.set(id, { ...n, readAt: new Date() });
      },
      async saveDevice(userId, d) {
        devices.set(d.token, { userId, platform: d.platform });
      },
    },
    outbox: {
      async enqueue(type, payload) {
        const id = randomUUID();
        outboxRows.set(id, {
          id,
          type,
          payload,
          attempts: 0,
          nextRunAt: Date.now(),
          publishedAt: null,
        });
        return id;
      },
      async lease(limit, leaseSeconds) {
        const now = Date.now();
        const due = [...outboxRows.values()]
          .filter((r) => r.publishedAt === null && r.nextRunAt <= now)
          .sort((a, b) => a.nextRunAt - b.nextRunAt)
          .slice(0, limit);
        for (const r of due) {
          r.attempts += 1;
          r.nextRunAt = now + leaseSeconds * 1000;
        }
        return due.map(({ id, type, payload, attempts }) => ({ id, type, payload, attempts }));
      },
      async get(id) {
        const r = outboxRows.get(id);
        return r && r.publishedAt === null
          ? { id: r.id, type: r.type, payload: r.payload, attempts: r.attempts }
          : null;
      },
      async markPublished(id) {
        const r = outboxRows.get(id);
        if (r) r.publishedAt = Date.now();
      },
      async retryLater(id, delaySeconds) {
        const r = outboxRows.get(id);
        if (r) r.nextRunAt = Date.now() + delaySeconds * 1000;
      },
      async backlog() {
        return [...outboxRows.values()].filter((r) => r.publishedAt === null).length;
      },
    },
    admin: {
      async listRequests(q) {
        const disputed = new Set(
          disputes.map((d) => jobs.get(d.jobId)?.requestId).filter((x): x is string => !!x),
        );
        const rows = [...reqs.values()]
          .filter((r) => !q.status || r.status === q.status)
          .filter((r) => q.hasDispute === undefined || disputed.has(r.id) === q.hasDispute);
        return pageOf(
          rows,
          q,
          (r) => r,
          (r) => {
            const a = aggregate(r);
            return {
              id: r.id,
              number: r.number,
              status: r.status,
              serviceName: a.service.name,
              customerName: a.customer.name,
              engineerName: a.engineer?.name ?? null,
              hasDispute: disputed.has(r.id),
              createdAt: r.createdAt,
            };
          },
        );
      },
      async listPayments(q) {
        const rows = [...payments.values()]
          .filter((p) => !q.status || p.status === q.status)
          .filter((p) => !q.method || p.method === q.method);
        return pageOf(
          rows,
          q,
          (p) => p,
          (p) => paymentRow(p),
        );
      },
      async paymentTotals() {
        const t = {
          collectedNet: 0,
          cashNet: 0,
          onlineNet: 0,
          refundedTotal: 0,
          pendingCount: 0,
          pendingAmount: 0,
        };
        for (const p of payments.values()) {
          if (p.status === 'PENDING') {
            t.pendingCount++;
            t.pendingAmount += p.amount;
          }
          if (p.status === 'PAID' || p.status === 'PARTIALLY_REFUNDED' || p.status === 'REFUNDED') {
            const net = p.amount - p.refunded;
            t.collectedNet += net;
            t.refundedTotal += p.refunded;
            if (p.method === 'CASH') t.cashNet += net;
            else t.onlineNet += net;
          }
        }
        return {
          collectedNet: round2(t.collectedNet),
          cashNet: round2(t.cashNet),
          onlineNet: round2(t.onlineNet),
          refundedTotal: round2(t.refundedTotal),
          pendingCount: t.pendingCount,
          pendingAmount: round2(t.pendingAmount),
        };
      },
      async refund(paymentId, d) {
        const p = payments.get(paymentId);
        if (!p || (p.status !== 'PAID' && p.status !== 'PARTIALLY_REFUNDED')) return { ok: false };
        if (round2(d.amount) > round2(p.amount - p.refunded)) return { ok: false };
        const refunded = round2(p.refunded + d.amount);
        const next: PaymentRecord = {
          ...p,
          refunded,
          status: refunded >= p.amount ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
        };
        payments.set(p.id, next);
        const refund: RefundRecord = {
          id: randomUUID(),
          paymentId: p.id,
          amount: d.amount,
          reason: d.reason,
          createdAt: new Date(),
        };
        refunds.push(refund);
        return { ok: true, refund, payment: { ...next } };
      },
      async listDisputes(q) {
        const rows = disputes.filter((d) => !q.status || d.status === q.status);
        return pageOf(
          rows,
          q,
          (d) => d,
          (d) => disputeRow(d),
        );
      },
      async getDispute(id) {
        const d = disputes.find((x) => x.id === id);
        return d ? disputeRow(d) : null;
      },
      async resolveDispute(id, d) {
        const row = disputes.find((x) => x.id === id);
        if (!row || row.status === 'RESOLVED' || row.status === 'REJECTED') return false;
        row.status = d.status;
        row.resolution = d.resolution;
        row.resolvedAt = new Date();
        return true;
      },
      async listReviews(q) {
        const rows = [...reviews.values()].filter(
          (r) => q.hidden === undefined || r.isHidden === q.hidden,
        );
        return pageOf(
          rows,
          q,
          (r) => r,
          (r) => reviewRow(r),
        );
      },
      async getReview(id) {
        const r = reviews.get(id);
        return r ? reviewRow(r) : null;
      },
      async setReviewHidden(id, hidden) {
        const r = reviews.get(id);
        if (!r) return null;
        reviews.set(id, { ...r, isHidden: hidden });
        const mine = [...reviews.values()].filter(
          (x) => x.engineerId === r.engineerId && !x.isHidden,
        );
        const prof = engineers.get(r.engineerId);
        if (prof)
          engineers.set(r.engineerId, {
            ...prof,
            ratingAverage: ratingAverage(mine.map((x) => x.rating)),
            ratingCount: mine.length,
          });
        return reviewRow(reviews.get(id)!);
      },
    },
    idempotency: {
      async find(userId, route, key) {
        const r = idem.get(`${userId}:${route}:${key}`);
        return r && r.expiresAt > Date.now() ? r : null;
      },
      async save(userId, route, key, r, ttlHours) {
        const k = `${userId}:${route}:${key}`;
        if (!idem.has(k)) idem.set(k, { ...r, expiresAt: Date.now() + ttlHours * 3_600_000 });
      },
    },
    audit: {
      async record(e) {
        audits.push(e);
      },
    },
    async close() {},
  };
}
