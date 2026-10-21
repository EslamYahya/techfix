import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { boot } from './helpers.js';

interface Op {
  security?: unknown[];
}
const spec = parse(
  readFileSync(
    fileURLToPath(new URL('../../../packages/contracts/openapi.yaml', import.meta.url)),
    'utf8',
  ),
) as {
  paths: Record<string, Record<string, Op>>;
};

/** Implemented surface (phases 1–6). Later phases add their own prefixes here. */
const PHASE1 = [
  /^\/auth\//,
  /^\/customers\/me/,
  /^\/engineers\/(me|\{engineerId\}$)/,
  /^\/service-categories/,
  /^\/services/,
  /^\/admin\/engineers/,
  /^\/admin\/services/,
  /^\/health/,
  /^\/engineer\/requests$/,
  /^\/service-requests(\/\{requestId\}(\/(recommendations|select-engineer|change-engineer|accept|reject|cancel|quotes))?)?$/,
  /^\/quotes\/\{quoteId\}\/(accept|reject)$/,
  /^\/additional-quotes\/\{quoteId\}\/(accept|reject)$/,
  /^\/jobs\/\{jobId\}(\/(start-trip|arrive|start|complete|confirm-completion|report-problem|additional-quotes))?$/,
  /^\/jobs\/\{jobId\}\/payments(\/confirm-cash)?$/,
  /^\/payments\/webhook$/,
  /^\/admin\/payments\/reconcile$/,
  /^\/jobs\/\{jobId\}\/review$/,
  /^\/engineers\/\{engineerId\}\/reviews$/,
  /^\/admin\/(service-requests(\/\{requestId\}\/cancel)?|payments|disputes(\/\{disputeId\}\/resolve)?|reviews(\/\{reviewId\}\/hide)?)$/,
  /^\/payments\/\{paymentId\}\/refund$/,
  /^\/notifications(\/(read-all|devices|\{id\}\/read))?$/,
];
const METHODS = ['get', 'post', 'put', 'patch', 'delete'];

let t: Awaited<ReturnType<typeof boot>>;
beforeAll(async () => {
  t = await boot();
});
afterAll(async () => {
  await t.close();
});

const ops = Object.entries(spec.paths)
  .filter(([p]) => PHASE1.some((r) => r.test(p)))
  .flatMap(([path, item]) =>
    METHODS.filter((m) => item[m]).map((method) => ({ path, method, op: item[method]! })),
  );
const fill = (p: string) => p.replace(/\{[^}]+\}/g, '00000000-0000-4000-8000-000000000000');
const isPublic = (o: Op) => Array.isArray(o.security) && o.security.length === 0;

describe('openapi ↔ API (phases 1–6)', () => {
  it('covers a meaningful number of operations', () => {
    expect(ops.length).toBeGreaterThanOrEqual(25);
  });

  it.each(
    ops
      .filter((o) => !isPublic(o.op))
      .map((o) => [`${o.method.toUpperCase()} ${o.path}`, o] as const),
  )('%s exists and rejects anonymous callers', async (_name, { path, method }) => {
    const res = await (
      t.http() as unknown as Record<string, (u: string) => Promise<{ status: number }>>
    )[method]!(`/api/v1${fill(path)}`);
    expect(res.status).toBe(401);
  });

  it.each(
    ops
      .filter((o) => isPublic(o.op))
      .map((o) => [`${o.method.toUpperCase()} ${o.path}`, o] as const),
  )('%s exists without login', async (_name, { path, method }) => {
    const res = await (
      t.http() as unknown as Record<
        string,
        (
          u: string,
        ) => Promise<{ status: number; body: { error?: { code: string; message: string } } }>
      >
    )[method]!(`/api/v1${fill(path)}`);
    // A real route answers with data, validation or a domain 404 — never the router's "Cannot GET".
    expect(res.body.error?.message ?? '').not.toMatch(/^Cannot /);
  });
});
