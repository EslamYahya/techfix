import { DomainError } from '@techfix/domain';
import type { ZodType, z } from 'zod';

/** Validates untrusted input. Details carry machine codes only (field + zod code); the UI words them in Arabic. */
export function parse<S extends ZodType>(schema: S, data: unknown): z.infer<S> {
  const r = schema.safeParse(data);
  if (r.success) return r.data;
  throw new DomainError(
    'VALIDATION_ERROR',
    'Invalid input',
    r.error.issues.map((i) => ({ field: i.path.join('.'), code: i.code })),
  );
}
