import { DomainError } from '@techfix/domain';

export interface Cursor {
  t: string; // createdAt ISO
  id: string;
}

export const encodeCursor = (c: Cursor): string =>
  Buffer.from(JSON.stringify(c)).toString('base64url');

export function decodeCursor(raw: string | undefined): Cursor | undefined {
  if (!raw) return undefined;
  try {
    const c = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Cursor;
    if (typeof c.t !== 'string' || typeof c.id !== 'string' || Number.isNaN(Date.parse(c.t)))
      throw 0;
    return c;
  } catch {
    throw new DomainError('VALIDATION_ERROR', 'Invalid cursor', [
      { field: 'cursor', code: 'invalid' },
    ]);
  }
}

export const clampLimit = (raw: unknown, def = 20, max = 100): number => {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? Math.min(n, max) : def;
};
