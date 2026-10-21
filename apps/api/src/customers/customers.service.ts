import { Inject, Injectable } from '@nestjs/common';
import { DomainError, isInSupportedArea, type Actor } from '@techfix/domain';
import { z } from 'zod';
import { parse } from '../common/zod.js';
import { REPOS, type Repos } from '../repos.js';

const ProfileSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    email: z
      .email()
      .max(120)
      .transform((e) => e.toLowerCase())
      .nullable(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'empty' });
const AddressSchema = z.object({
  label: z.string().trim().min(1).max(40),
  address: z.string().trim().min(3).max(300),
  city: z.string().trim().max(60).optional(),
  area: z.string().trim().max(80).optional(),
  latitude: z.number(),
  longitude: z.number(),
  isDefault: z.boolean().optional(),
});

@Injectable()
export class CustomersService {
  constructor(@Inject(REPOS) private readonly repos: Repos) {}

  private customerId(actor: Actor): string {
    if (actor.role !== 'CUSTOMER' || !actor.profileId) throw new DomainError('FORBIDDEN');
    return actor.profileId;
  }

  async me(actor: Actor) {
    this.customerId(actor);
    const a = await this.repos.identity.findById(actor.id);
    if (!a) throw new DomainError('NOT_FOUND');
    return { id: a.customerId, name: a.user.name, phone: a.user.phone, email: a.user.email };
  }

  async updateMe(actor: Actor, body: unknown) {
    this.customerId(actor);
    const patch = parse(ProfileSchema, body);
    await this.repos.identity.updateUser(actor.id, patch);
    return this.me(actor);
  }

  addresses(actor: Actor) {
    return this.repos.customers.listAddresses(this.customerId(actor));
  }

  addAddress(actor: Actor, body: unknown) {
    const id = this.customerId(actor);
    const a = parse(AddressSchema, body);
    if (!isInSupportedArea(a.latitude, a.longitude))
      throw new DomainError('VALIDATION_ERROR', 'Outside the supported area', [
        { field: 'latitude', code: 'out_of_area' },
      ]);
    return this.repos.customers.addAddress(id, {
      label: a.label,
      address: a.address,
      city: a.city ?? null,
      area: a.area ?? null,
      latitude: a.latitude,
      longitude: a.longitude,
      isDefault: a.isDefault ?? false,
    });
  }
}
