import { Inject, Injectable } from '@nestjs/common';
import { CATALOG_SEED, DomainError } from '@techfix/domain';
import { hashPassword } from './auth/password.js';
import { normalizePhone } from './auth/phone.js';
import { ENV, type Env } from './config/env.js';
import { REPOS, type Repos } from './repos.js';

/** Idempotent: the launch catalog, and the first admin when SEED_ADMIN_* are set. Admins are never self-registered. */
@Injectable()
export class SeedService {
  constructor(
    @Inject(REPOS) private readonly repos: Repos,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async run(): Promise<{ admin: 'created' | 'exists' | 'skipped' }> {
    await this.repos.catalog.seed(CATALOG_SEED);
    const { SEED_ADMIN_PHONE: rawPhone, SEED_ADMIN_PASSWORD: password } = this.env;
    if (!rawPhone || !password) return { admin: 'skipped' };
    const phone = normalizePhone(rawPhone);
    if (!phone) throw new Error('SEED_ADMIN_PHONE is not a valid Egyptian mobile number');
    if (await this.repos.identity.findByLogin({ phone })) return { admin: 'exists' };
    try {
      await this.repos.identity.create({
        name: this.env.SEED_ADMIN_NAME,
        phone,
        email: null,
        passwordHash: await hashPassword(password),
        role: 'ADMIN',
      });
    } catch (e) {
      if (e instanceof DomainError && e.code === 'CONFLICT') return { admin: 'exists' };
      throw e;
    }
    return { admin: 'created' };
  }
}
