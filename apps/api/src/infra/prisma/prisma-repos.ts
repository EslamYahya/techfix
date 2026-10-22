import { DomainError, ratingAverage, round2, type CatalogSeedCategory } from '@techfix/domain';
import { Prisma, createPrismaClient, type PrismaClient } from '@techfix/db';
import type {
  AdminPaymentRow,
  AdminReviewRow,
  DisputeRow,
  AccountRecord,
  AddressRecord,
  AdminEngineerRow,
  EngineerAggregate,
  EngineerProfileRecord,
  JobRecord,
  MatchRow,
  NewQuote,
  PaymentRecord,
  ReviewRecord,
  QuoteRecord,
  RequestAggregate,
  RequestChange,
  RequestListQuery,
  Repos,
  ServiceView,
  UserRecord,
} from '../../repos.js';

const codeOf = (e: unknown): string | undefined => (e as { code?: string } | null)?.code;
const isUnique = (e: unknown): boolean => codeOf(e) === 'P2002';

type ServiceRow = Prisma.ServiceGetPayload<{ include: { category: true } }>;
const serviceView = (s: ServiceRow): ServiceView => ({
  id: s.id,
  name: s.name,
  slug: s.slug,
  description: s.description,
  isActive: s.isActive,
  category: {
    id: s.category.id,
    name: s.category.name,
    slug: s.category.slug,
    description: s.category.description,
  },
});

const userRecord = (u: {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  passwordHash: string;
  role: UserRecord['role'];
  status: UserRecord['status'];
  createdAt: Date;
}): UserRecord => ({ ...u });

const profileRecord = (p: Prisma.EngineerProfileGetPayload<object>): EngineerProfileRecord => ({
  id: p.id,
  userId: p.userId,
  engineerType: p.engineerType,
  bio: p.bio,
  experienceYears: p.experienceYears,
  verificationStatus: p.verificationStatus,
  rejectionReason: p.rejectionReason,
  availabilityStatus: p.availabilityStatus,
  serviceRadiusKm: p.serviceRadiusKm,
  ratingAverage: Number(p.ratingAverage),
  ratingCount: p.ratingCount,
  completedJobsCount: p.completedJobsCount,
  createdAt: p.createdAt,
});

const requestInclude = {
  location: true,
  attachments: true,
  service: { include: { category: true } },
  customer: { include: { user: true } },
  engineer: { include: { user: true, locations: { where: { isPrimary: true }, take: 1 } } },
  events: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.ServiceRequestInclude;
type RequestRow = Prisma.ServiceRequestGetPayload<{ include: typeof requestInclude }>;

const requestAggregate = (r: RequestRow): RequestAggregate => ({
  request: {
    id: r.id,
    number: r.publicNumber,
    customerId: r.customerId,
    serviceId: r.serviceId,
    subService: r.subServiceLabel,
    description: r.description,
    preferredDate: r.preferredDate.toISOString().slice(0, 10),
    preferredSlot: r.preferredSlot,
    preferredStartTime: r.preferredStartTime,
    preferredEndTime: r.preferredEndTime,
    status: r.status,
    selectedEngineerId: r.selectedEngineerId,
    cancelReason: r.cancelReason,
    version: r.version,
    createdAt: r.createdAt,
    location: {
      latitude: r.location?.latitude ?? 0,
      longitude: r.location?.longitude ?? 0,
      address: r.location?.address ?? '',
      city: r.location?.city ?? null,
      area: r.location?.area ?? null,
    },
    attachmentKeys: r.attachments.map((a) => a.fileKey),
  },
  service: serviceView(r.service),
  customer: { name: r.customer.user.name, phone: r.customer.user.phone },
  engineer: r.engineer
    ? {
        id: r.engineer.id,
        name: r.engineer.user.name,
        phone: r.engineer.user.phone,
        area: r.engineer.locations[0]?.area ?? null,
      }
    : null,
  events: r.events.map((e) => ({
    at: e.createdAt,
    fromState: e.fromState,
    toState: e.toState,
    actorRole: e.actorRole ?? 'SYSTEM',
    code: e.code,
  })),
});

type Tx = Prisma.TransactionClient;
/** Thrown inside a transaction to roll it back when the request moved or the quote was already decided. */
class Stale extends Error {}

/** The one place a request changes state: version check, timeline, exclusion, quote withdrawal, job mirror. */
async function applyChange(tx: Tx, id: string, c: RequestChange): Promise<boolean> {
  const res = await tx.serviceRequest.updateMany({
    where: { id, version: c.expectedVersion, status: c.from },
    data: {
      status: c.to,
      version: { increment: 1 },
      ...(c.selectedEngineerId !== undefined ? { selectedEngineerId: c.selectedEngineerId } : {}),
      ...(c.cancel ? { cancelReason: c.cancel.reason, cancelledBy: c.cancel.by } : {}),
    },
  });
  if (res.count !== 1) return false;
  await tx.requestEvent.create({
    data: {
      requestId: id,
      fromState: c.from,
      toState: c.to,
      actorId: c.event.actorId,
      actorRole: c.event.actorRole === 'SYSTEM' ? null : c.event.actorRole,
      code: c.event.code,
    },
  });
  if (c.exclude)
    await tx.engineerRejection.create({
      data: {
        requestId: id,
        engineerId: c.exclude.engineerId,
        reason: c.exclude.reason,
        timedOut: c.exclude.timedOut ?? false,
      },
    });
  if (c.cancelOpenQuotes)
    await tx.quote.updateMany({
      where: { requestId: id, status: 'SENT' },
      data: { status: 'CANCELLED', decidedAt: new Date() },
    });
  await tx.job.updateMany({
    where: { requestId: id },
    data: { status: c.to, ...(c.jobStamp ? { [c.jobStamp]: new Date() } : {}) },
  });
  return true;
}

const paymentRecord = (p: Prisma.PaymentGetPayload<object>): PaymentRecord => ({
  id: p.id,
  jobId: p.jobId,
  amount: Number(p.amount),
  method: p.method,
  status: p.status,
  provider: p.provider,
  providerRef: p.providerRef,
  failureReason: p.failureReason,
  refunded: Number(p.refundedAmount),
  paidAt: p.paidAt,
  confirmedBy: p.confirmedBy,
  expiresAt: p.expiresAt,
  createdAt: p.createdAt,
});

/** Keyset condition shared by every newest-first list. */
const keyset = (c?: { t: string; id: string }) =>
  c
    ? {
        OR: [{ createdAt: { lt: new Date(c.t) } }, { createdAt: new Date(c.t), id: { lt: c.id } }],
      }
    : {};
/** `take: limit + 1` was asked for: the extra row only tells there is a next page. */
function pageOut<R extends { id: string; createdAt: Date }, T>(
  rows: R[],
  limit: number,
  map: (r: R) => T,
): { items: T[]; next: { t: string; id: string } | null } {
  const items = rows.slice(0, limit);
  const last = items.at(-1);
  return {
    items: items.map(map),
    next: rows.length > limit && last ? { t: last.createdAt.toISOString(), id: last.id } : null,
  };
}

const disputeInclude = {
  openedBy: true,
  job: { include: { request: { select: { id: true, publicNumber: true } } } },
} satisfies Prisma.DisputeInclude;
const disputeRow = (
  d: Prisma.DisputeGetPayload<{ include: typeof disputeInclude }>,
): DisputeRow => ({
  id: d.id,
  jobId: d.jobId,
  requestId: d.job.request.id,
  requestNumber: d.job.request.publicNumber,
  openedByUserId: d.openedByUserId,
  openedByName: d.openedBy.name,
  openedByRole: d.openedBy.role,
  reason: d.reason,
  description: d.description,
  status: d.status,
  resolution: d.resolution,
  resolvedAt: d.resolvedAt,
  createdAt: d.createdAt,
});
const adminReviewInclude = {
  customer: { include: { user: true } },
  engineer: { include: { user: true } },
  job: { include: { request: { select: { publicNumber: true } } } },
} satisfies Prisma.ReviewInclude;
const adminReviewRow = (
  r: Prisma.ReviewGetPayload<{ include: typeof adminReviewInclude }>,
): AdminReviewRow => ({
  id: r.id,
  jobId: r.jobId,
  customerId: r.customerId,
  engineerId: r.engineerId,
  rating: r.rating,
  comment: r.comment,
  isHidden: r.isHidden,
  createdAt: r.createdAt,
  customerName: r.customer.user.name,
  engineerName: r.engineer.user.name,
  requestNumber: r.job.request.publicNumber,
});

const reviewInclude = { customer: { include: { user: true } } } satisfies Prisma.ReviewInclude;
const reviewRecord = (
  r: Prisma.ReviewGetPayload<{ include: typeof reviewInclude }>,
): ReviewRecord => ({
  id: r.id,
  jobId: r.jobId,
  customerId: r.customerId,
  engineerId: r.engineerId,
  rating: r.rating,
  comment: r.comment,
  isHidden: r.isHidden,
  createdAt: r.createdAt,
  customerName: r.customer.user.name,
});

const quoteInclude = { items: { orderBy: { createdAt: 'asc' } } } satisfies Prisma.QuoteInclude;
type QuoteRow = Prisma.QuoteGetPayload<{ include: typeof quoteInclude }>;
const quoteRecord = (q: QuoteRow): QuoteRecord => ({
  id: q.id,
  requestId: q.requestId,
  engineerId: q.engineerId,
  kind: q.kind,
  parentQuoteId: q.parentQuoteId,
  status: q.status,
  items: q.items.map((i) => ({
    type: i.itemType,
    description: i.description,
    quantity: Number(i.quantity),
    unitPrice: Number(i.unitPrice),
    totalPrice: Number(i.totalPrice),
  })),
  subtotal: Number(q.subtotal),
  total: Number(q.total),
  notes: q.notes,
  estimatedDurationMinutes: q.estimatedDurationMinutes,
  rejectionReason: q.rejectionReason,
  expiresAt: q.expiresAt,
  sentAt: q.sentAt,
  decidedAt: q.decidedAt,
  createdAt: q.createdAt,
});
const jobRecord = (j: Prisma.JobGetPayload<object>): JobRecord => ({
  id: j.id,
  requestId: j.requestId,
  quoteId: j.quoteId,
  customerId: j.customerId,
  engineerId: j.engineerId,
  status: j.status,
  confirmedAt: j.confirmedAt,
  startedTripAt: j.startedTripAt,
  arrivedAt: j.arrivedAt,
  startedAt: j.startedAt,
  completedAt: j.completedAt,
  confirmedByCustomerAt: j.confirmedByCustomerAt,
  createdAt: j.createdAt,
});
const quoteData = (q: NewQuote, status: 'SENT') => ({
  requestId: q.requestId,
  engineerId: q.engineerId,
  kind: q.kind,
  parentQuoteId: q.parentQuoteId,
  status,
  subtotal: q.subtotal,
  total: q.total,
  notes: q.notes,
  estimatedDurationMinutes: q.estimatedDurationMinutes,
  expiresAt: q.expiresAt,
  sentAt: new Date(),
  items: {
    create: q.items.map((i) => ({
      itemType: i.type,
      description: i.description,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      totalPrice: i.totalPrice,
    })),
  },
});

/** PostgreSQL adapter (Prisma 7 + driver adapter). PostGIS `point` columns are filled by the sync trigger. */
export function createPrismaRepos(connectionString: string): Repos {
  const db: PrismaClient = createPrismaClient(connectionString);

  const account = async (userId: string): Promise<AccountRecord | null> => {
    const u = await db.user.findUnique({
      where: { id: userId },
      include: { customer: true, engineer: true },
    });
    return u
      ? {
          user: userRecord(u),
          customerId: u.customer?.id ?? null,
          engineerId: u.engineer?.id ?? null,
          verification: u.engineer?.verificationStatus ?? null,
        }
      : null;
  };

  return {
    identity: {
      findById: (id) => account(id),
      async findByLogin(login) {
        const u = await db.user.findUnique({
          where: 'phone' in login ? { phone: login.phone } : { email: login.email },
          select: { id: true },
        });
        return u ? account(u.id) : null;
      },
      async create(input) {
        try {
          const u = await db.user.create({
            data: {
              name: input.name,
              phone: input.phone,
              email: input.email,
              passwordHash: input.passwordHash,
              role: input.role,
              ...(input.role === 'CUSTOMER' ? { customer: { create: {} } } : {}),
              ...(input.role === 'ENGINEER' && input.engineer
                ? {
                    engineer: {
                      create: {
                        engineerType: input.engineer.hasShop ? 'SHOP_OWNER' : 'FREELANCE',
                        experienceYears: input.engineer.experienceYears,
                        services: {
                          create: input.engineer.serviceIds.map((serviceId) => ({ serviceId })),
                        },
                      },
                    },
                  }
                : {}),
            },
          });
          return (await account(u.id))!;
        } catch (e) {
          if (isUnique(e)) throw new DomainError('CONFLICT', 'Phone or email already registered');
          throw e;
        }
      },
      async updateUser(id, patch) {
        try {
          return userRecord(
            await db.user.update({
              where: { id },
              data: {
                ...(patch.name ? { name: patch.name } : {}),
                ...('email' in patch ? { email: patch.email ?? null } : {}),
              },
            }),
          );
        } catch (e) {
          if (isUnique(e)) throw new DomainError('CONFLICT', 'Email already registered');
          throw e;
        }
      },
      async setStatus(id, status) {
        await db.user.update({ where: { id }, data: { status } });
      },
    },

    tokens: {
      async insert(t) {
        await db.refreshToken.create({ data: t });
      },
      async consume(tokenHash, now) {
        const claimed = await db.refreshToken.updateMany({
          where: { tokenHash, revokedAt: null, expiresAt: { gt: now } },
          data: { revokedAt: now },
        });
        const rec = await db.refreshToken.findUnique({ where: { tokenHash } });
        if (!rec) return { status: 'unknown' };
        const record = {
          id: rec.id,
          userId: rec.userId,
          familyId: rec.familyId,
          expiresAt: rec.expiresAt,
          revokedAt: rec.revokedAt,
        };
        if (claimed.count === 1) return { status: 'ok', record };
        return rec.revokedAt ? { status: 'reused', record } : { status: 'unknown' };
      },
      async revokeFamily(familyId) {
        await db.refreshToken.updateMany({
          where: { familyId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      },
      async revokeAllForUser(userId) {
        await db.refreshToken.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      },
    },

    catalog: {
      async listCategories() {
        const rows = await db.serviceCategory.findMany({
          where: { isActive: true },
          orderBy: { createdAt: 'asc' },
        });
        return rows.map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          description: c.description,
        }));
      },
      async listServices({ categorySlug, activeOnly }) {
        const rows = await db.service.findMany({
          where: {
            ...(activeOnly ? { isActive: true } : {}),
            ...(categorySlug ? { category: { slug: categorySlug } } : {}),
          },
          include: { category: true },
          orderBy: [{ category: { createdAt: 'asc' } }, { createdAt: 'asc' }],
        });
        return rows.map(serviceView);
      },
      async getService(id) {
        const s = await db.service.findUnique({ where: { id }, include: { category: true } });
        return s ? serviceView(s) : null;
      },
      async findServices(ids) {
        const rows = await db.service.findMany({
          where: { id: { in: ids } },
          include: { category: true },
        });
        return rows.map(serviceView);
      },
      async createService(s) {
        try {
          return serviceView(await db.service.create({ data: s, include: { category: true } }));
        } catch (e) {
          if (isUnique(e)) throw new DomainError('CONFLICT', 'Slug taken');
          if (codeOf(e) === 'P2003') throw new DomainError('NOT_FOUND', 'Category not found');
          throw e;
        }
      },
      async updateService(id, patch) {
        try {
          return serviceView(
            await db.service.update({ where: { id }, data: patch, include: { category: true } }),
          );
        } catch (e) {
          if (codeOf(e) === 'P2025') return null;
          throw e;
        }
      },
      async seed(data: readonly CatalogSeedCategory[]) {
        for (const c of data) {
          const cat = await db.serviceCategory.upsert({
            where: { slug: c.slug },
            update: {},
            create: { slug: c.slug, name: c.name, description: c.description },
          });
          for (const s of c.services)
            await db.service.upsert({
              where: { slug: s.slug },
              update: {},
              create: { slug: s.slug, name: s.name, categoryId: cat.id },
            });
        }
      },
    },

    engineers: {
      async get(id): Promise<EngineerAggregate | null> {
        const p = await db.engineerProfile.findUnique({
          where: { id },
          include: {
            user: true,
            services: { include: { service: { include: { category: true } } } },
            locations: { where: { isPrimary: true }, take: 1 },
            schedule: {
              where: { isActive: true },
              orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
            },
            documents: { orderBy: { createdAt: 'asc' } },
          },
        });
        if (!p) return null;
        const loc = p.locations[0];
        return {
          profile: profileRecord(p),
          user: {
            name: p.user.name,
            phone: p.user.phone,
            email: p.user.email,
            status: p.user.status,
          },
          services: p.services.map((x) => serviceView(x.service)),
          location: loc
            ? {
                latitude: loc.latitude,
                longitude: loc.longitude,
                address: loc.address,
                area: loc.area,
              }
            : null,
          schedule: p.schedule.map((s) => ({
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
          })),
          documents: p.documents.map((d) => ({
            id: d.id,
            kind: d.kind,
            approved: d.approved,
            createdAt: d.createdAt,
          })),
        };
      },
      async updateProfile(id, patch) {
        await db.engineerProfile.update({ where: { id }, data: patch });
      },
      async addDocument(engineerId, d) {
        const r = await db.engineerDocument.create({
          data: { engineerId, kind: d.kind, fileKey: d.fileKey },
        });
        return { id: r.id, kind: r.kind, approved: r.approved, createdAt: r.createdAt };
      },
      async setLocation(engineerId, loc) {
        const existing = await db.engineerLocation.findFirst({
          where: { engineerId, isPrimary: true },
        });
        const data = {
          latitude: loc.latitude,
          longitude: loc.longitude,
          address: loc.address,
          area: loc.area,
        };
        if (existing) await db.engineerLocation.update({ where: { id: existing.id }, data });
        else await db.engineerLocation.create({ data: { engineerId, isPrimary: true, ...data } });
      },
      async replaceSchedule(engineerId, slots) {
        await db.$transaction([
          db.availability.deleteMany({ where: { engineerId } }),
          db.availability.createMany({ data: slots.map((s) => ({ engineerId, ...s })) }),
        ]);
      },
      async addService(engineerId, serviceId) {
        try {
          await db.engineerService.create({ data: { engineerId, serviceId } });
        } catch (e) {
          if (isUnique(e)) throw new DomainError('CONFLICT', 'Already added');
          throw e;
        }
      },
      async removeService(engineerId, serviceId) {
        const r = await db.engineerService.deleteMany({ where: { engineerId, serviceId } });
        return r.count > 0;
      },
      async setAvailability(id, availabilityStatus) {
        await db.engineerProfile.update({ where: { id }, data: { availabilityStatus } });
      },
      async setVerification(id, verificationStatus, rejectionReason) {
        await db.engineerProfile.update({
          where: { id },
          data: { verificationStatus, rejectionReason },
        });
      },
      async list({ verification, limit, cursor }) {
        const rows = await db.engineerProfile.findMany({
          where: {
            ...(verification ? { verificationStatus: verification } : {}),
            ...(cursor
              ? {
                  OR: [
                    { createdAt: { lt: new Date(cursor.t) } },
                    { createdAt: new Date(cursor.t), id: { lt: cursor.id } },
                  ],
                }
              : {}),
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: limit + 1,
          include: { user: true, _count: { select: { documents: true } } },
        });
        const page = rows.slice(0, limit);
        const last = page.at(-1);
        const items: AdminEngineerRow[] = page.map((p) => ({
          id: p.id,
          userId: p.userId,
          name: p.user.name,
          phone: p.user.phone,
          accountStatus: p.user.status,
          verificationStatus: p.verificationStatus,
          availabilityStatus: p.availabilityStatus,
          documentsCount: p._count.documents,
          createdAt: p.createdAt,
        }));
        return {
          items,
          next:
            rows.length > limit && last ? { t: last.createdAt.toISOString(), id: last.id } : null,
        };
      },
    },

    customers: {
      async listAddresses(customerId) {
        const rows = await db.customerAddress.findMany({
          where: { customerId },
          orderBy: { createdAt: 'asc' },
        });
        return rows.map(addressRecord);
      },
      async addAddress(customerId, a) {
        return db.$transaction(async (tx) => {
          const count = await tx.customerAddress.count({ where: { customerId } });
          const isDefault = a.isDefault || count === 0;
          if (isDefault)
            await tx.customerAddress.updateMany({
              where: { customerId },
              data: { isDefault: false },
            });
          return addressRecord(
            await tx.customerAddress.create({ data: { customerId, ...a, isDefault } }),
          );
        });
      },
    },

    requests: {
      async create(input) {
        const r = await db.serviceRequest.create({
          data: {
            customerId: input.customerId,
            serviceId: input.serviceId,
            subServiceLabel: input.subService,
            description: input.description,
            preferredDate: new Date(`${input.preferredDate}T00:00:00.000Z`),
            preferredSlot: input.preferredSlot,
            preferredStartTime: input.preferredStartTime,
            preferredEndTime: input.preferredEndTime,
            status: 'MATCHING',
            location: { create: { ...input.location } },
            attachments: {
              create: input.attachmentKeys.map((fileKey) => ({ fileKey, fileType: 'IMAGE' })),
            },
            events: {
              create: {
                fromState: 'REQUESTED',
                toState: 'MATCHING',
                actorRole: 'CUSTOMER',
                code: 'REQUEST_CREATED',
              },
            },
          },
          include: requestInclude,
        });
        return requestAggregate(r).request;
      },
      async get(id) {
        const r = await db.serviceRequest.findUnique({ where: { id }, include: requestInclude });
        return r ? requestAggregate(r) : null;
      },
      async listForCustomer(customerId, q) {
        return listRequests(db, { customerId }, q);
      },
      async listForEngineer(engineerId, q) {
        return listRequests(db, { selectedEngineerId: engineerId }, q);
      },
      async apply(id, c) {
        return db.$transaction((tx) => applyChange(tx, id, c));
      },
      async excludedEngineers(id) {
        const rows = await db.engineerRejection.findMany({
          where: { requestId: id },
          select: { engineerId: true },
          distinct: ['engineerId'],
        });
        return rows.map((r) => r.engineerId);
      },
      async matchCandidates({ serviceId, latitude, longitude }) {
        // PostGIS: geography distance in metres, restricted to each engineer's own service radius.
        const rows = await db.$queryRaw<
          {
            id: string;
            name: string;
            status: string;
            verification: string;
            availability: string;
            radius: number;
            rating: number;
            rating_count: number;
            experience: number;
            jobs: number;
            area: string | null;
            km: number;
          }[]
        >`
          SELECT ep.id, u.name, u.status::text AS status, ep.verification_status::text AS verification,
                 ep.availability_status::text AS availability, ep.service_radius_km AS radius,
                 ep.rating_average::float8 AS rating, ep.rating_count, ep.experience_years AS experience,
                 ep.completed_jobs_count AS jobs, el.area,
                 (ST_Distance(el.point, ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography) / 1000)::float8 AS km
          FROM engineer_profiles ep
          JOIN users u ON u.id = ep.user_id
          JOIN engineer_services es ON es.engineer_id = ep.id AND es.service_id = ${serviceId}::uuid
          JOIN engineer_locations el ON el.engineer_id = ep.id AND el.is_primary
          WHERE ST_DWithin(el.point, ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography, ep.service_radius_km * 1000)`;
        return rows.map((r) => ({
          engineerId: r.id,
          accountActive: r.status === 'ACTIVE',
          verified: r.verification === 'VERIFIED',
          serviceIds: [serviceId],
          subServices: null,
          availability: r.availability as MatchRow['availability'],
          serviceRadiusKm: Number(r.radius),
          distanceKm: Number(r.km),
          ratingAverage: Number(r.rating),
          experienceYears: Number(r.experience),
          completedJobs: Number(r.jobs),
          name: r.name,
          area: r.area,
          ratingCount: Number(r.rating_count),
        }));
      },
    },
    quotes: {
      async list(requestId) {
        const rows = await db.quote.findMany({
          where: { requestId },
          include: quoteInclude,
          orderBy: { createdAt: 'asc' },
        });
        return rows.map(quoteRecord);
      },
      async get(id) {
        const q = await db.quote.findUnique({ where: { id }, include: quoteInclude });
        return q ? quoteRecord(q) : null;
      },
      /** Test seam: move a quote's validity into the past without going through the service. */
      async expire(id, expiresAt) {
        await db.quote.update({ where: { id }, data: { expiresAt } });
      },
      async sendMain(q, change) {
        try {
          return await db.$transaction(async (tx) => {
            if (!(await applyChange(tx, q.requestId, change))) throw new Stale();
            const row = await tx.quote.create({
              data: quoteData(q, 'SENT'),
              include: quoteInclude,
            });
            return quoteRecord(row);
          });
        } catch (e) {
          if (e instanceof Stale) return null;
          throw e;
        }
      },
      async acceptMain(quoteId, change) {
        try {
          return await db.$transaction(async (tx) => {
            // The validity guard runs inside the transaction, on the row we are about to decide: an
            // expired quote has to be refused by the database, not by the copy the caller read a
            // moment earlier, which is stale as soon as anything else touches the quote.
            const q = await tx.quote.findUnique({ where: { id: quoteId } });
            if (!q || (q.status === 'SENT' && q.expiresAt !== null && q.expiresAt < new Date()))
              throw new Stale();
            const won = await tx.quote.updateMany({
              where: { id: quoteId, status: 'SENT', kind: 'MAIN' },
              data: { status: 'ACCEPTED', decidedAt: new Date() },
            });
            if (won.count !== 1 || !(await applyChange(tx, q.requestId, change))) throw new Stale();
            const r = await tx.serviceRequest.findUniqueOrThrow({ where: { id: q.requestId } });
            const job = await tx.job.create({
              data: {
                requestId: q.requestId,
                quoteId,
                customerId: r.customerId,
                engineerId: q.engineerId,
                status: change.to,
              },
            });
            return jobRecord(job);
          });
        } catch (e) {
          if (e instanceof Stale) return null;
          throw e;
        }
      },
      async rejectMain(quoteId, reason, change) {
        try {
          return await db.$transaction(async (tx) => {
            const q = await tx.quote.findUnique({ where: { id: quoteId } });
            if (!q) throw new Stale();
            const won = await tx.quote.updateMany({
              where: { id: quoteId, status: 'SENT', kind: 'MAIN' },
              data: { status: 'REJECTED', rejectionReason: reason, decidedAt: new Date() },
            });
            if (won.count !== 1 || !(await applyChange(tx, q.requestId, change))) throw new Stale();
            return true;
          });
        } catch (e) {
          if (e instanceof Stale) return false;
          throw e;
        }
      },
      async sendAdditional(q, expectedVersion) {
        try {
          return await db.$transaction(async (tx) => {
            const r = await tx.serviceRequest.findFirst({
              where: { id: q.requestId, version: expectedVersion },
            });
            if (!r) throw new Stale();
            const pending = await tx.quote.count({
              where: { requestId: q.requestId, kind: 'ADDITIONAL', status: 'SENT' },
            });
            if (pending > 0) throw new DomainError('PENDING_ADDITIONAL_QUOTE');
            const row = await tx.quote.create({
              data: quoteData(q, 'SENT'),
              include: quoteInclude,
            });
            return quoteRecord(row);
          });
        } catch (e) {
          if (e instanceof Stale) return null;
          // the partial unique index quotes_one_open_per_kind catches a concurrent second request
          if (isUnique(e)) throw new DomainError('PENDING_ADDITIONAL_QUOTE');
          throw e;
        }
      },
      async decideAdditional(quoteId, status, reason) {
        const r = await db.quote.updateMany({
          where: { id: quoteId, kind: 'ADDITIONAL', status: 'SENT' },
          data: { status, rejectionReason: reason, decidedAt: new Date() },
        });
        return r.count === 1;
      },
    },

    jobs: {
      async get(id) {
        const j = await db.job.findUnique({ where: { id } });
        return j ? jobRecord(j) : null;
      },
      async getByRequest(requestId) {
        const j = await db.job.findUnique({ where: { requestId } });
        return j ? jobRecord(j) : null;
      },
      async openDispute(d) {
        const row = await db.dispute.create({
          data: {
            jobId: d.jobId,
            openedByUserId: d.userId,
            reason: d.reason,
            description: d.description,
          },
        });
        return { id: row.id };
      },
    },

    payments: {
      async get(id) {
        const p = await db.payment.findUnique({ where: { id } });
        return p ? paymentRecord(p) : null;
      },
      async listForJob(jobId) {
        const rows = await db.payment.findMany({ where: { jobId }, orderBy: { createdAt: 'asc' } });
        return rows.map(paymentRecord);
      },
      async listPendingOnline(olderThan) {
        const rows = await db.payment.findMany({
          where: {
            method: 'ONLINE',
            status: 'PENDING',
            providerRef: { not: null },
            createdAt: { lt: olderThan },
          },
          orderBy: { createdAt: 'asc' },
          take: 200,
        });
        return rows.map(paymentRecord);
      },
      async create(np, change) {
        try {
          return await db.$transaction(async (tx) => {
            const job = await tx.job.findUnique({ where: { id: np.jobId } });
            if (!job) throw new Stale();
            if (change && !(await applyChange(tx, job.requestId, change))) throw new Stale();
            const row = await tx.payment.create({
              data: {
                jobId: np.jobId,
                amount: np.amount,
                method: np.method,
                provider: np.provider,
                status: 'PENDING',
              },
            });
            return paymentRecord(row);
          });
        } catch (e) {
          if (e instanceof Stale) return null;
          // payments_one_pending_online (partial unique index) catches a concurrent second order
          if (isUnique(e))
            throw new DomainError('CONFLICT', 'An online payment is already pending');
          throw e;
        }
      },
      async attachProvider(id, d) {
        await db.payment.update({
          where: { id },
          data: { providerRef: d.providerRef, expiresAt: d.expiresAt },
        });
      },
      async discard(id, reason) {
        await db.payment.updateMany({
          where: { id, status: 'PENDING' },
          data: { status: 'FAILED', failureReason: reason },
        });
      },
      async recordWebhook(e) {
        try {
          const row = await db.webhookEvent.create({
            data: {
              provider: e.provider,
              externalId: e.externalId,
              payload: e.payload as Prisma.InputJsonValue,
              signatureOk: e.signatureOk,
            },
          });
          return { id: row.id, duplicate: false };
        } catch (err) {
          if (!isUnique(err)) throw err;
          const row = await db.webhookEvent.findUniqueOrThrow({
            where: { provider_externalId: { provider: e.provider, externalId: e.externalId } },
          });
          return { id: row.id, duplicate: row.processedAt !== null };
        }
      },
      async finishWebhook(id, error) {
        await db.webhookEvent.update({
          where: { id },
          data: { processedAt: new Date(), error },
        });
      },
      async settle(id, outcome, change) {
        return db.$transaction(async (tx) => {
          // PENDING → PAID/FAILED, or FAILED → PAID (late success): the status filter is the lock.
          const won = await tx.payment.updateMany({
            where: {
              id,
              status: outcome.status === 'PAID' ? { in: ['PENDING', 'FAILED'] } : 'PENDING',
            },
            data: {
              status: outcome.status,
              paidAt: outcome.status === 'PAID' ? new Date() : null,
              failureReason: outcome.status === 'FAILED' ? (outcome.failureReason ?? null) : null,
              ...(outcome.providerRef ? { providerRef: outcome.providerRef } : {}),
            },
          });
          if (won.count !== 1) return { settled: false, changed: false };
          let changed = false;
          if (change) {
            const p = await tx.payment.findUniqueOrThrow({ where: { id }, include: { job: true } });
            const r = await tx.serviceRequest.findUniqueOrThrow({ where: { id: p.job.requestId } });
            changed = await applyChange(tx, p.job.requestId, change);
          }
          return { settled: true, changed };
        });
      },
      async confirmCash(id, d) {
        const r = await db.payment.updateMany({
          where: { id, method: 'CASH', status: 'PENDING' },
          data: {
            amount: d.amount,
            status: 'PAID',
            paidAt: new Date(),
            confirmedBy: d.engineerUserId,
          },
        });
        return r.count === 1;
      },
    },

    reviews: {
      async getByJob(jobId) {
        const r = await db.review.findUnique({ where: { jobId }, include: reviewInclude });
        return r ? reviewRecord(r) : null;
      },
      async create(r, change) {
        try {
          return await db.$transaction(async (tx) => {
            const job = await tx.job.findUnique({ where: { id: r.jobId } });
            if (!job || !(await applyChange(tx, job.requestId, change))) throw new Stale();
            const row = await tx.review.create({
              data: {
                jobId: r.jobId,
                customerId: r.customerId,
                engineerId: r.engineerId,
                rating: r.rating,
                comment: r.comment,
              },
              include: reviewInclude,
            });
            const visible = await tx.review.findMany({
              where: { engineerId: r.engineerId, isHidden: false },
              select: { rating: true },
            });
            await tx.engineerProfile.update({
              where: { id: r.engineerId },
              data: {
                ratingAverage: ratingAverage(visible.map((x) => x.rating)),
                ratingCount: visible.length,
              },
            });
            return reviewRecord(row);
          });
        } catch (e) {
          if (e instanceof Stale) return null;
          if (isUnique(e)) throw new DomainError('CONFLICT', 'Already reviewed');
          throw e;
        }
      },
      async listForEngineer(engineerId, q) {
        const rows = await db.review.findMany({
          where: {
            engineerId,
            isHidden: false,
            ...(q.cursor
              ? {
                  OR: [
                    { createdAt: { lt: new Date(q.cursor.t) } },
                    { createdAt: new Date(q.cursor.t), id: { lt: q.cursor.id } },
                  ],
                }
              : {}),
          },
          include: reviewInclude,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: q.limit + 1,
        });
        const items = rows.slice(0, q.limit);
        const last = items.at(-1);
        return {
          items: items.map(reviewRecord),
          next:
            rows.length > q.limit && last ? { t: last.createdAt.toISOString(), id: last.id } : null,
        };
      },
    },

    notifications: {
      async recipientsOf(requestId, engineerProfileId) {
        const r = await db.serviceRequest.findUnique({
          where: { id: requestId },
          select: {
            selectedEngineerId: true,
            customer: { select: { userId: true } },
          },
        });
        if (!r) return null;
        const engId = engineerProfileId ?? r.selectedEngineerId;
        const eng = engId
          ? await db.engineerProfile.findUnique({ where: { id: engId }, select: { userId: true } })
          : null;
        return { customerUserId: r.customer.userId, engineerUserId: eng?.userId ?? null };
      },
      async adminUserIds() {
        const rows = await db.user.findMany({
          where: { role: 'ADMIN', status: 'ACTIVE' },
          select: { id: true },
        });
        return rows.map((u) => u.id);
      },
      async createOnce(n) {
        const dup = await db.notification.findFirst({
          where: { userId: n.userId, data: { path: ['eventId'], equals: n.data.eventId } },
          select: { id: true },
        });
        if (dup) return false;
        await db.notification.create({
          data: {
            userId: n.userId,
            type: n.type,
            title: n.title,
            body: n.body,
            data: n.data as Prisma.InputJsonValue,
          },
        });
        return true;
      },
      async list(userId, q) {
        const rows = await db.notification.findMany({
          where: {
            userId,
            ...(q.unread ? { readAt: null } : {}),
            ...(q.cursor
              ? {
                  OR: [
                    { createdAt: { lt: new Date(q.cursor.t) } },
                    { createdAt: new Date(q.cursor.t), id: { lt: q.cursor.id } },
                  ],
                }
              : {}),
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: q.limit + 1,
        });
        return rows.map((x) => ({
          id: x.id,
          userId: x.userId,
          type: x.type,
          title: x.title,
          body: x.body,
          data: (x.data as Record<string, unknown> | null) ?? null,
          readAt: x.readAt,
          createdAt: x.createdAt,
        }));
      },
      async unreadCount(userId) {
        return db.notification.count({ where: { userId, readAt: null } });
      },
      async markRead(userId, id) {
        const own = await db.notification.findFirst({
          where: { id, userId },
          select: { id: true },
        });
        if (!own) return false;
        await db.notification.updateMany({
          where: { id, readAt: null },
          data: { readAt: new Date() },
        });
        return true;
      },
      async markAllRead(userId) {
        await db.notification.updateMany({
          where: { userId, readAt: null },
          data: { readAt: new Date() },
        });
      },
      async saveDevice(userId, d) {
        await db.deviceToken.upsert({
          where: { token: d.token },
          create: { userId, token: d.token, platform: d.platform },
          update: { userId, platform: d.platform },
        });
      },
    },

    outbox: {
      async enqueue(type, payload) {
        const r = await db.outboxEvent.create({
          data: { type, payload: payload as Prisma.InputJsonValue },
          select: { id: true },
        });
        return r.id;
      },
      async lease(limit, leaseSeconds) {
        // Atomic hand-out: SKIP LOCKED lets several workers poll the same table without overlap.
        // Use the application clock so retry timing is deterministic in workers and tests;
        // PostgreSQL's `now()` otherwise ignores a mocked application clock.
        const now = new Date();
        const rows = await db.$queryRaw<
          { id: string; type: string; payload: Record<string, unknown>; attempts: number }[]
        >`
          UPDATE outbox_events SET attempts = attempts + 1,
                 next_run_at = ${new Date(now.getTime() + leaseSeconds * 1000)}
           WHERE id IN (SELECT id FROM outbox_events
                         WHERE published_at IS NULL AND next_run_at <= ${now}
                         ORDER BY next_run_at LIMIT ${limit} FOR UPDATE SKIP LOCKED)
          RETURNING id, type, payload, attempts`;
        return rows.map((r) => ({
          id: r.id,
          type: r.type,
          payload: r.payload,
          attempts: r.attempts,
        }));
      },
      async get(id) {
        const r = await db.outboxEvent.findFirst({ where: { id, publishedAt: null } });
        return r
          ? {
              id: r.id,
              type: r.type,
              payload: r.payload as Record<string, unknown>,
              attempts: r.attempts,
            }
          : null;
      },
      async markPublished(id) {
        await db.outboxEvent.update({ where: { id }, data: { publishedAt: new Date() } });
      },
      async retryLater(id, delaySeconds) {
        await db.outboxEvent.update({
          where: { id },
          data: { nextRunAt: new Date(Date.now() + delaySeconds * 1000) },
        });
      },
      async backlog() {
        return db.outboxEvent.count({ where: { publishedAt: null } });
      },
    },

    admin: {
      async listRequests(q) {
        const rows = await db.serviceRequest.findMany({
          where: {
            ...(q.status ? { status: q.status } : {}),
            ...(q.hasDispute === undefined
              ? {}
              : { job: q.hasDispute ? { disputes: { some: {} } } : { disputes: { none: {} } } }),
            ...keyset(q.cursor),
          },
          include: {
            service: true,
            customer: { include: { user: true } },
            engineer: { include: { user: true } },
            job: { select: { _count: { select: { disputes: true } } } },
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: q.limit + 1,
        });
        return pageOut(rows, q.limit, (r) => ({
          id: r.id,
          number: r.publicNumber,
          status: r.status,
          serviceName: r.service.name,
          customerName: r.customer.user.name,
          engineerName: r.engineer?.user.name ?? null,
          hasDispute: (r.job?._count.disputes ?? 0) > 0,
          createdAt: r.createdAt,
        }));
      },
      async listPayments(q) {
        const rows = await db.payment.findMany({
          where: {
            ...(q.status ? { status: q.status } : {}),
            ...(q.method ? { method: q.method } : {}),
            ...keyset(q.cursor),
          },
          include: {
            job: {
              include: {
                request: { select: { id: true, publicNumber: true } },
                customer: { include: { user: true } },
                engineer: { include: { user: true } },
              },
            },
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: q.limit + 1,
        });
        return pageOut(rows, q.limit, (p) => ({
          ...paymentRecord(p),
          requestId: p.job.request.id,
          requestNumber: p.job.request.publicNumber,
          customerName: p.job.customer.user.name,
          engineerName: p.job.engineer.user.name,
        }));
      },
      async paymentTotals() {
        const rows = await db.payment.groupBy({
          by: ['method', 'status'],
          _sum: { amount: true, refundedAmount: true },
          _count: { _all: true },
        });
        const t = {
          collectedNet: 0,
          cashNet: 0,
          onlineNet: 0,
          refundedTotal: 0,
          pendingCount: 0,
          pendingAmount: 0,
        };
        for (const r of rows) {
          const amount = Number(r._sum.amount ?? 0);
          const refunded = Number(r._sum.refundedAmount ?? 0);
          if (r.status === 'PENDING') {
            t.pendingCount += r._count._all;
            t.pendingAmount += amount;
          } else if (['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(r.status)) {
            t.collectedNet += amount - refunded;
            t.refundedTotal += refunded;
            if (r.method === 'CASH') t.cashNet += amount - refunded;
            else t.onlineNet += amount - refunded;
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
        return db.$transaction(async (tx) => {
          // Row lock: two admins refunding the same payment at once are serialised.
          await tx.$queryRaw`SELECT id FROM payments WHERE id = ${paymentId}::uuid FOR UPDATE`;
          const p = await tx.payment.findUnique({ where: { id: paymentId } });
          if (!p || (p.status !== 'PAID' && p.status !== 'PARTIALLY_REFUNDED'))
            return { ok: false as const };
          const left = round2(Number(p.amount) - Number(p.refundedAmount));
          if (round2(d.amount) > left) return { ok: false as const };
          const refunded = round2(Number(p.refundedAmount) + d.amount);
          const row = await tx.payment.update({
            where: { id: p.id },
            data: {
              refundedAmount: refunded,
              status: refunded >= Number(p.amount) ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
            },
          });
          const ref = await tx.paymentRefund.create({
            data: { paymentId: p.id, amount: d.amount, reason: d.reason, createdBy: d.adminId },
          });
          return {
            ok: true as const,
            refund: {
              id: ref.id,
              paymentId: ref.paymentId,
              amount: Number(ref.amount),
              reason: ref.reason,
              createdAt: ref.createdAt,
            },
            payment: paymentRecord(row),
          };
        });
      },
      async listDisputes(q) {
        const rows = await db.dispute.findMany({
          where: { ...(q.status ? { status: q.status } : {}), ...keyset(q.cursor) },
          include: disputeInclude,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: q.limit + 1,
        });
        return pageOut(rows, q.limit, disputeRow);
      },
      async getDispute(id) {
        const r = await db.dispute.findUnique({ where: { id }, include: disputeInclude });
        return r ? disputeRow(r) : null;
      },
      async resolveDispute(id, d) {
        const r = await db.dispute.updateMany({
          where: { id, status: { in: ['OPEN', 'UNDER_REVIEW'] } },
          data: {
            status: d.status,
            resolution: d.resolution,
            resolvedBy: d.adminId,
            resolvedAt: new Date(),
          },
        });
        return r.count === 1;
      },
      async listReviews(q) {
        const rows = await db.review.findMany({
          where: {
            ...(q.hidden === undefined ? {} : { isHidden: q.hidden }),
            ...keyset(q.cursor),
          },
          include: adminReviewInclude,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: q.limit + 1,
        });
        return pageOut(rows, q.limit, adminReviewRow);
      },
      async getReview(id) {
        const r = await db.review.findUnique({ where: { id }, include: adminReviewInclude });
        return r ? adminReviewRow(r) : null;
      },
      async setReviewHidden(id, hidden) {
        return db.$transaction(async (tx) => {
          const cur = await tx.review.findUnique({ where: { id } });
          if (!cur) return null;
          await tx.review.update({ where: { id }, data: { isHidden: hidden } });
          const visible = await tx.review.findMany({
            where: { engineerId: cur.engineerId, isHidden: false },
            select: { rating: true },
          });
          await tx.engineerProfile.update({
            where: { id: cur.engineerId },
            data: {
              ratingAverage: ratingAverage(visible.map((x) => x.rating)),
              ratingCount: visible.length,
            },
          });
          const r = await tx.review.findUniqueOrThrow({
            where: { id },
            include: adminReviewInclude,
          });
          return adminReviewRow(r);
        });
      },
    },

    idempotency: {
      async find(userId, route, key) {
        const r = await db.idempotencyKey.findUnique({
          where: { userId_route_key: { userId, route, key } },
        });
        return r && r.expiresAt > new Date()
          ? { bodyHash: r.bodyHash, code: r.responseCode, body: r.responseBody }
          : null;
      },
      async save(userId, route, key, r, ttlHours) {
        try {
          await db.idempotencyKey.create({
            data: {
              userId,
              route,
              key,
              bodyHash: r.bodyHash,
              responseCode: r.code,
              responseBody: r.body as Prisma.InputJsonValue,
              expiresAt: new Date(Date.now() + ttlHours * 3_600_000),
            },
          });
        } catch (e) {
          if (!isUnique(e)) throw e;
        }
      },
    },

    audit: {
      async record(e) {
        await db.auditLog.create({
          data: {
            actorUserId: e.actorUserId,
            action: e.action,
            entityType: e.entityType,
            entityId: e.entityId,
            beforeData: (e.before ?? undefined) as Prisma.InputJsonValue | undefined,
            afterData: (e.after ?? undefined) as Prisma.InputJsonValue | undefined,
            requestId: e.requestId ?? null,
            ip: e.ip ?? null,
          },
        });
      },
    },

    async close() {
      await db.$disconnect();
    },
  };
}

async function listRequests(
  db: PrismaClient,
  where: Prisma.ServiceRequestWhereInput,
  q: RequestListQuery,
) {
  const rows = await db.serviceRequest.findMany({
    where: {
      ...where,
      ...(q.status ? { status: q.status } : {}),
      ...(q.cursor
        ? {
            OR: [
              { createdAt: { lt: new Date(q.cursor.t) } },
              { createdAt: new Date(q.cursor.t), id: { lt: q.cursor.id } },
            ],
          }
        : {}),
    },
    include: requestInclude,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: q.limit + 1,
  });
  const items = rows.slice(0, q.limit);
  const last = items.at(-1);
  return {
    items: items.map(requestAggregate),
    next: rows.length > q.limit && last ? { t: last.createdAt.toISOString(), id: last.id } : null,
  };
}

const addressRecord = (r: {
  id: string;
  label: string;
  address: string;
  city: string | null;
  area: string | null;
  latitude: number;
  longitude: number;
  isDefault: boolean;
}): AddressRecord => ({
  id: r.id,
  label: r.label,
  address: r.address,
  city: r.city,
  area: r.area,
  latitude: r.latitude,
  longitude: r.longitude,
  isDefault: r.isDefault,
});
