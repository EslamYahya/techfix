import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { parse } from 'yaml';
import { ERROR_HTTP, REQUEST_STATUSES } from '@techfix/domain';

const spec = parse(fs.readFileSync(new URL('../openapi.yaml', import.meta.url), 'utf8'));

describe('openapi ↔ domain', () => {
  it('RequestStatus enum equals the state machine', () => {
    expect(spec.components.schemas.RequestStatus.enum).toEqual([...REQUEST_STATUSES]);
  });
  it('ErrorCode enum equals the domain error table', () => {
    expect([...spec.components.schemas.ErrorCode.enum].sort()).toEqual(
      Object.keys(ERROR_HTTP).sort(),
    );
  });
  it('no request schema accepts a client-computed total', () => {
    const q = spec.components.schemas.QuoteInput.properties;
    expect(Object.keys(q)).not.toContain('total');
    expect(Object.keys(q.items.items.properties)).not.toContain('totalPrice');
  });
  it('the payment webhook is unauthenticated (signature-verified instead)', () => {
    expect(spec.paths['/payments/webhook'].post.security).toEqual([]);
  });
});
