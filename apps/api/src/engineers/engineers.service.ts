import { Inject, Injectable } from '@nestjs/common';
import { DomainError, isInSupportedArea, type Actor } from '@techfix/domain';
import { z } from 'zod';
import type { AuditCtx } from '../catalog/catalog.service.js';
import { serviceDto } from '../catalog/catalog.service.js';
import { clampLimit, decodeCursor, encodeCursor } from '../common/pagination.js';
import { parse } from '../common/zod.js';
import { REPOS, type EngineerAggregate, type Repos, type Verification } from '../repos.js';
import { ScheduleSchema, validateSchedule } from './schedule.js';

const ProfileSchema = z
  .object({
    bio: z.string().trim().max(600).nullable(),
    experienceYears: z.number().int().min(0).max(60),
    serviceRadiusKm: z.number().int().min(1).max(100),
    hasShop: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'empty' });
const DocumentSchema = z.object({
  kind: z.enum(['NATIONAL_ID', 'CERTIFICATE', 'CRAFT_LICENSE', 'OTHER']),
  // An object-storage key, never a URL.
  fileKey: z
    .string()
    .min(3)
    .max(200)
    .regex(/^[A-Za-z0-9][A-Za-z0-9/_.-]*$/)
    .refine((k) => !k.includes('..')),
});
const StatusSchema = z.object({ status: z.enum(['AVAILABLE', 'OFFLINE', 'BUSY']) });
const LocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  address: z.string().trim().max(300).optional(),
  area: z.string().trim().max(80).optional(),
});
const ServiceSchema = z.object({ serviceId: z.uuid() });
const VerifySchema = z.object({
  approved: z.boolean(),
  reason: z.string().trim().min(3).max(300).optional(),
});
const isUuid = (s: string) => z.uuid().safeParse(s).success;

/** What the engineer sees about themselves. */
const mine = (a: EngineerAggregate) => ({
  id: a.profile.id,
  name: a.user.name,
  phone: a.user.phone,
  email: a.user.email,
  accountStatus: a.user.status,
  hasShop: a.profile.engineerType === 'SHOP_OWNER',
  bio: a.profile.bio,
  experienceYears: a.profile.experienceYears,
  verificationStatus: a.profile.verificationStatus,
  rejectionReason: a.profile.rejectionReason,
  availabilityStatus: a.profile.availabilityStatus,
  serviceRadiusKm: a.profile.serviceRadiusKm,
  rating: { average: a.profile.ratingAverage, count: a.profile.ratingCount },
  completedJobs: a.profile.completedJobsCount,
  services: a.services.map(serviceDto),
  location: a.location,
  schedule: a.schedule,
  documents: a.documents.map((d) => ({
    id: d.id,
    kind: d.kind,
    approved: d.approved,
    createdAt: d.createdAt,
  })),
});

/** What customers see: no phone, no exact location (area only). */
const card = (a: EngineerAggregate) => ({
  id: a.profile.id,
  name: a.user.name,
  hasShop: a.profile.engineerType === 'SHOP_OWNER',
  bio: a.profile.bio,
  experienceYears: a.profile.experienceYears,
  rating: { average: a.profile.ratingAverage, count: a.profile.ratingCount },
  completedJobs: a.profile.completedJobsCount,
  availabilityStatus: a.profile.availabilityStatus,
  area: a.location?.area ?? null,
  services: a.services.filter((s) => s.isActive).map(serviceDto),
});

@Injectable()
export class EngineersService {
  constructor(@Inject(REPOS) private readonly repos: Repos) {}

  private engineerId(actor: Actor): string {
    if (actor.role !== 'ENGINEER' || !actor.profileId) throw new DomainError('FORBIDDEN');
    return actor.profileId;
  }
  private async load(id: string) {
    const a = await this.repos.engineers.get(id);
    if (!a) throw new DomainError('NOT_FOUND');
    return a;
  }

  async me(actor: Actor) {
    return mine(await this.load(this.engineerId(actor)));
  }

  async updateMe(actor: Actor, body: unknown) {
    const id = this.engineerId(actor);
    const { hasShop, ...rest } = parse(ProfileSchema, body);
    await this.repos.engineers.updateProfile(id, {
      ...rest,
      ...(hasShop === undefined
        ? {}
        : { engineerType: hasShop ? ('SHOP_OWNER' as const) : ('FREELANCE' as const) }),
    });
    return mine(await this.load(id));
  }

  async addDocument(actor: Actor, body: unknown) {
    const id = this.engineerId(actor);
    const input = parse(DocumentSchema, body);
    const d = await this.repos.engineers.addDocument(id, input);
    // A rejected engineer who uploads new documents goes back into the review queue.
    const a = await this.load(id);
    if (a.profile.verificationStatus === 'REJECTED')
      await this.repos.engineers.setVerification(id, 'PENDING', null);
    return { id: d.id, kind: d.kind, approved: d.approved, createdAt: d.createdAt };
  }

  async setStatus(actor: Actor, body: unknown) {
    const id = this.engineerId(actor);
    const { status } = parse(StatusSchema, body);
    await this.repos.engineers.setAvailability(id, status);
    return { availabilityStatus: status };
  }

  async schedule(actor: Actor) {
    return { slots: (await this.load(this.engineerId(actor))).schedule };
  }

  async replaceSchedule(actor: Actor, body: unknown) {
    const id = this.engineerId(actor);
    const { slots } = parse(ScheduleSchema, body);
    const clean = validateSchedule(slots);
    await this.repos.engineers.replaceSchedule(id, clean);
    return { slots: clean };
  }

  async setLocation(actor: Actor, body: unknown) {
    const id = this.engineerId(actor);
    const g = parse(LocationSchema, body);
    if (!isInSupportedArea(g.latitude, g.longitude))
      throw new DomainError('VALIDATION_ERROR', 'Outside the supported area', [
        { field: 'latitude', code: 'out_of_area' },
      ]);
    const loc = {
      latitude: g.latitude,
      longitude: g.longitude,
      address: g.address ?? null,
      area: g.area ?? null,
    };
    await this.repos.engineers.setLocation(id, loc);
    return loc;
  }

  async services(actor: Actor) {
    return (await this.load(this.engineerId(actor))).services.map(serviceDto);
  }

  async addService(actor: Actor, body: unknown) {
    const id = this.engineerId(actor);
    const { serviceId } = parse(ServiceSchema, body);
    const s = await this.repos.catalog.getService(serviceId);
    if (!s || !s.isActive)
      throw new DomainError('VALIDATION_ERROR', 'Unknown service', [
        { field: 'serviceId', code: 'invalid_value' },
      ]);
    await this.repos.engineers.addService(id, serviceId);
    return serviceDto(s);
  }

  async removeService(actor: Actor, serviceId: string) {
    const id = this.engineerId(actor);
    const removed = isUuid(serviceId) && (await this.repos.engineers.removeService(id, serviceId));
    if (!removed) throw new DomainError('NOT_FOUND');
  }

  /** Public card: only verified, active engineers exist for customers; everyone else is 404. */
  async publicCard(engineerId: string) {
    const a = isUuid(engineerId) ? await this.repos.engineers.get(engineerId) : null;
    if (!a || a.profile.verificationStatus !== 'VERIFIED' || a.user.status !== 'ACTIVE')
      throw new DomainError('NOT_FOUND');
    return card(a);
  }

  // ───── admin ─────

  async adminList(q: { verification?: string; limit?: string; cursor?: string }) {
    const verification = z
      .enum(['PENDING', 'VERIFIED', 'REJECTED'])
      .optional()
      .parse(q.verification) as Verification | undefined;
    const limit = clampLimit(q.limit);
    const { items, next } = await this.repos.engineers.list({
      verification,
      limit,
      cursor: decodeCursor(q.cursor),
    });
    return { data: items, meta: { nextCursor: next ? encodeCursor(next) : null } };
  }

  async verify(engineerId: string, body: unknown, audit: AuditCtx) {
    const { approved, reason } = parse(VerifySchema, body);
    if (!approved && !reason)
      throw new DomainError('VALIDATION_ERROR', 'Reason required', [
        { field: 'reason', code: 'required' },
      ]);
    const a = await this.target(engineerId);
    if (a.profile.verificationStatus !== 'PENDING')
      throw new DomainError('INVALID_STATE_TRANSITION', `Already ${a.profile.verificationStatus}`);
    const status: Verification = approved ? 'VERIFIED' : 'REJECTED';
    await this.repos.engineers.setVerification(engineerId, status, approved ? null : reason!);
    await this.repos.audit.record({
      ...audit,
      action: approved ? 'engineer.verify' : 'engineer.reject',
      entityType: 'engineer',
      entityId: engineerId,
      before: { verificationStatus: a.profile.verificationStatus },
      after: { verificationStatus: status, reason: reason ?? null },
    });
    return { id: engineerId, verificationStatus: status };
  }

  async suspend(engineerId: string, audit: AuditCtx) {
    const a = await this.target(engineerId);
    if (a.user.status === 'SUSPENDED')
      throw new DomainError('INVALID_STATE_TRANSITION', 'Already suspended');
    await this.repos.identity.setStatus(a.profile.userId, 'SUSPENDED');
    await this.repos.engineers.setAvailability(engineerId, 'OFFLINE'); // hidden from matching at once
    await this.repos.tokens.revokeAllForUser(a.profile.userId);
    await this.repos.audit.record({
      ...audit,
      action: 'engineer.suspend',
      entityType: 'engineer',
      entityId: engineerId,
      before: { accountStatus: a.user.status },
      after: { accountStatus: 'SUSPENDED' },
    });
    return { id: engineerId, accountStatus: 'SUSPENDED' as const };
  }

  async reinstate(engineerId: string, audit: AuditCtx) {
    const a = await this.target(engineerId);
    if (a.user.status !== 'SUSPENDED')
      throw new DomainError('INVALID_STATE_TRANSITION', 'Not suspended');
    await this.repos.identity.setStatus(a.profile.userId, 'ACTIVE');
    await this.repos.audit.record({
      ...audit,
      action: 'engineer.reinstate',
      entityType: 'engineer',
      entityId: engineerId,
      before: { accountStatus: 'SUSPENDED' },
      after: { accountStatus: 'ACTIVE' },
    });
    return { id: engineerId, accountStatus: 'ACTIVE' as const };
  }

  private async target(engineerId: string) {
    const a = isUuid(engineerId) ? await this.repos.engineers.get(engineerId) : null;
    if (!a) throw new DomainError('NOT_FOUND');
    return a;
  }
}
