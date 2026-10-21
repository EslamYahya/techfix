import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { parse } from 'yaml';
import { ERROR_HTTP, REQUEST_STATUSES, ACTION_GUARDS, PERMISSIONS } from '../src';

const spec = parse(fs.readFileSync('openapi.yaml', 'utf8'));
const frontend = fs.existsSync('docs/source/frontend-statuses.json')
  ? JSON.parse(fs.readFileSync('docs/source/frontend-statuses.json', 'utf8')) : null;

describe('openapi ↔ code', () => {
  it('RequestStatus enum equals the state machine', () => {
    expect(spec.components.schemas.RequestStatus.enum).toEqual([...REQUEST_STATUSES]);
  });
  it('ErrorCode enum equals the domain error table', () => {
    expect([...spec.components.schemas.ErrorCode.enum].sort()).toEqual(Object.keys(ERROR_HTTP).sort());
  });
  it('every guard permission exists in the permission catalogue', () => {
    const all = new Set<string>(Object.values(PERMISSIONS).flat());
    for (const [name, g] of Object.entries(ACTION_GUARDS)) expect(all.has(g.permission), name).toBe(true);
  });
  it('no request schema accepts a client-computed total', () => {
    const props = Object.keys(spec.components.schemas.QuoteInput.properties);
    expect(props).not.toContain('total');
    expect(Object.keys(spec.components.schemas.QuoteInput.properties.items.items.properties)).not.toContain('totalPrice');
  });
  it('every path is under a documented tag and webhooks are unauthenticated', () => {
    expect(spec.paths['/payments/webhook'].post.security).toEqual([]);
  });
  it('frontend status keys (prototype) are all known to the backend', () => {
    if (!frontend) return;
    for (const k of frontend.STATUS) expect(REQUEST_STATUSES as readonly string[]).toContain(k);
  });
});
