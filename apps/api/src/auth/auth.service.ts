import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '@techfix/domain';
import { z } from 'zod';
import { parse } from '../common/zod.js';
import { ENV, type Env } from '../config/env.js';
import { REPOS, type AccountRecord, type Repos } from '../repos.js';
import { DUMMY_HASH, hashPassword, verifyPassword } from './password.js';
import { normalizePhone } from './phone.js';
import { RateLimiter } from './rate-limiter.js';
import { TokenService, sha256 } from './token.service.js';

const phone = z.string().transform((v, ctx) => {
  const p = normalizePhone(v);
  if (!p) ctx.addIssue({ code: 'custom', message: 'phone' });
  return p ?? '';
});

export const RegisterSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone,
  email: z
    .email()
    .max(120)
    .transform((e) => e.toLowerCase())
    .optional(),
  password: z.string().min(8).max(128),
  role: z.enum(['CUSTOMER', 'ENGINEER']),
  serviceIds: z.array(z.uuid()).max(30).optional(),
  experienceYears: z.number().int().min(0).max(60).optional(),
  hasShop: z.boolean().optional(),
});

const LoginSchema = z.object({
  identifier: z.string().trim().min(3).max(120),
  password: z.string().min(1).max(128),
});
const RefreshSchema = z.object({ refreshToken: z.string().min(20).max(200) });

export interface AuthResult {
  user: { id: string; name: string; role: string };
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(REPOS) private readonly repos: Repos,
    @Inject(TokenService) private readonly tokens: TokenService,
    @Inject(RateLimiter) private readonly limiter: RateLimiter,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async register(body: unknown, ip: string): Promise<AuthResult> {
    this.limiter.hit(`register:${ip}`, this.env.AUTH_REGISTER_MAX_PER_HOUR, 3_600_000);
    const input = parse(RegisterSchema, body);
    const serviceIds = [...new Set(input.serviceIds ?? [])];
    if (
      input.role === 'CUSTOMER' &&
      (serviceIds.length || input.experienceYears !== undefined || input.hasShop)
    )
      throw new DomainError('VALIDATION_ERROR', 'Engineer-only fields', [
        { field: 'role', code: 'custom' },
      ]);
    if (serviceIds.length) {
      const found = await this.repos.catalog.findServices(serviceIds);
      if (found.length !== serviceIds.length || found.some((s) => !s.isActive))
        throw new DomainError('VALIDATION_ERROR', 'Unknown service', [
          { field: 'serviceIds', code: 'invalid_value' },
        ]);
    }
    const account = await this.repos.identity.create({
      name: input.name,
      phone: input.phone,
      email: input.email ?? null,
      passwordHash: await hashPassword(input.password),
      role: input.role,
      engineer:
        input.role === 'ENGINEER'
          ? {
              experienceYears: input.experienceYears ?? 0,
              hasShop: input.hasShop ?? false,
              serviceIds,
            }
          : undefined,
    });
    return this.issue(account);
  }

  async login(body: unknown, ip: string): Promise<AuthResult> {
    const input = parse(LoginSchema, body);
    this.limiter.hit(
      `login:${ip}:${input.identifier.toLowerCase()}`,
      this.env.AUTH_LOGIN_MAX_PER_15MIN,
      900_000,
    );
    const login = input.identifier.includes('@')
      ? { email: input.identifier.toLowerCase() }
      : { phone: normalizePhone(input.identifier) ?? '' };
    const account = await this.repos.identity.findByLogin(login);
    // Same work and same error whether the account exists or not.
    const ok = await verifyPassword(input.password, account?.user.passwordHash ?? DUMMY_HASH);
    if (!account || !ok) throw new DomainError('UNAUTHORIZED', 'Invalid credentials');
    if (account.user.status === 'SUSPENDED') throw new DomainError('ACCOUNT_SUSPENDED');
    return this.issue(account);
  }

  async refresh(body: unknown): Promise<AuthResult> {
    const { refreshToken } = parse(RefreshSchema, body);
    const res = await this.repos.tokens.consume(sha256(refreshToken), new Date());
    if (res.status === 'unknown') throw new DomainError('UNAUTHORIZED');
    if (res.status === 'reused') {
      // A rotated token came back: assume theft and kill the whole family.
      await this.repos.tokens.revokeFamily(res.record.familyId);
      throw new DomainError('UNAUTHORIZED');
    }
    const account = await this.repos.identity.findById(res.record.userId);
    if (!account) throw new DomainError('UNAUTHORIZED');
    if (account.user.status === 'SUSPENDED') throw new DomainError('ACCOUNT_SUSPENDED');
    return this.issue(account, res.record.familyId);
  }

  async logout(userId: string, body: unknown): Promise<void> {
    const parsed = RefreshSchema.safeParse(body);
    if (parsed.success) {
      const res = await this.repos.tokens.consume(sha256(parsed.data.refreshToken), new Date());
      if ((res.status === 'ok' || res.status === 'reused') && res.record.userId === userId) {
        await this.repos.tokens.revokeFamily(res.record.familyId);
        return;
      }
    }
    await this.repos.tokens.revokeAllForUser(userId);
  }

  private async issue(account: AccountRecord, familyId?: string): Promise<AuthResult> {
    const refresh = this.tokens.newRefresh();
    await this.repos.tokens.insert({
      userId: account.user.id,
      tokenHash: refresh.hash,
      familyId: familyId ?? refresh.familyId(),
      expiresAt: refresh.expiresAt,
    });
    return {
      user: { id: account.user.id, name: account.user.name, role: account.user.role },
      accessToken: await this.tokens.signAccess(account.user.id, account.user.role),
      refreshToken: refresh.token,
    };
  }
}
