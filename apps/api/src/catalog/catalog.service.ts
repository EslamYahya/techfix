import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '@techfix/domain';
import { z } from 'zod';
import { parse } from '../common/zod.js';
import { REPOS, type Repos, type ServiceView } from '../repos.js';

const slug = z
  .string()
  .min(3)
  .max(60)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
const CreateSchema = z.object({
  categoryId: z.uuid(),
  name: z.string().trim().min(2).max(80),
  slug,
  description: z.string().trim().max(300).nullish(),
});
const UpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    description: z.string().trim().max(300).nullable(),
    isActive: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'empty' });

const isUuid = (s: string) => z.uuid().safeParse(s).success;

export const serviceDto = (s: ServiceView) => ({
  id: s.id,
  name: s.name,
  slug: s.slug,
  description: s.description,
  isActive: s.isActive,
  category: { id: s.category.id, name: s.category.name, slug: s.category.slug },
});

@Injectable()
export class CatalogService {
  constructor(@Inject(REPOS) private readonly repos: Repos) {}

  categories() {
    return this.repos.catalog.listCategories();
  }

  async services(categorySlug?: string) {
    const list = await this.repos.catalog.listServices({ categorySlug, activeOnly: true });
    return list.map(serviceDto);
  }

  async service(id: string) {
    const s = isUuid(id) ? await this.repos.catalog.getService(id) : null;
    if (!s || !s.isActive) throw new DomainError('NOT_FOUND');
    return serviceDto(s);
  }

  async create(body: unknown, audit: AuditCtx) {
    const input = parse(CreateSchema, body);
    const s = await this.repos.catalog.createService({
      ...input,
      description: input.description ?? null,
    });
    await this.repos.audit.record({
      ...audit,
      action: 'service.create',
      entityType: 'service',
      entityId: s.id,
      after: serviceDto(s),
    });
    return serviceDto(s);
  }

  async update(id: string, body: unknown, audit: AuditCtx) {
    const patch = parse(UpdateSchema, body);
    const before = isUuid(id) ? await this.repos.catalog.getService(id) : null;
    if (!before) throw new DomainError('NOT_FOUND');
    const s = (await this.repos.catalog.updateService(id, patch))!;
    await this.repos.audit.record({
      ...audit,
      action: 'service.update',
      entityType: 'service',
      entityId: id,
      before: serviceDto(before),
      after: serviceDto(s),
    });
    return serviceDto(s);
  }
}

export interface AuditCtx {
  actorUserId: string;
  requestId?: string | null;
  ip?: string | null;
}
