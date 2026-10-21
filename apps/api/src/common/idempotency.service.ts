import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '@techfix/domain';
import { ENV, type Env } from '../config/env.js';
import { REPOS, type Repos } from '../repos.js';

const KEY = /^[A-Za-z0-9._:-]{8,128}$/;

/**
 * `Idempotency-Key` for requests that move money or state. Same key + same request → the first
 * response is replayed and nothing runs twice; same key + different request → 409 IDEMPOTENCY_CONFLICT.
 * Failed attempts are not stored, so a retry after an error simply runs again.
 */
@Injectable()
export class IdempotencyService {
  constructor(
    @Inject(REPOS) private readonly repos: Repos,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async run<T>(
    userId: string,
    route: string,
    key: string | undefined,
    body: unknown,
    fn: () => Promise<T>,
  ): Promise<T> {
    if (key === undefined) return fn();
    if (!KEY.test(key)) throw new DomainError('VALIDATION_ERROR', 'Invalid Idempotency-Key');
    const bodyHash = createHash('sha256')
      .update(JSON.stringify(body ?? null))
      .digest('hex');
    const stored = await this.repos.idempotency.find(userId, route, key);
    if (stored) {
      if (stored.bodyHash !== bodyHash) throw new DomainError('IDEMPOTENCY_CONFLICT');
      return stored.body as T;
    }
    const out = await fn();
    await this.repos.idempotency.save(
      userId,
      route,
      key,
      { bodyHash, code: 200, body: out },
      this.env.IDEMPOTENCY_TTL_HOURS,
    );
    return out;
  }
}
