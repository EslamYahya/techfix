import { Injectable } from '@nestjs/common';
import { DomainError } from '@techfix/domain';

/** Fixed-window counter, per process. Phase 5 swaps this for a Redis-backed limiter behind the same method. */
@Injectable()
export class RateLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  hit(key: string, max: number, windowMs: number): void {
    const now = Date.now();
    const cur = this.hits.get(key);
    if (!cur || cur.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + windowMs });
      if (this.hits.size > 10_000) this.sweep(now);
      return;
    }
    cur.count += 1;
    if (cur.count > max) throw new DomainError('RATE_LIMITED');
  }

  private sweep(now: number): void {
    for (const [k, v] of this.hits) if (v.resetAt <= now) this.hits.delete(k);
  }
}
