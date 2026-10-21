import { errorText } from '../labels';

/** Thrown for every failed call. `code` is the machine code; `message` is already Arabic. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly details: { field: string; code: string }[] = [],
  ) {
    super(errorText(code));
  }
}

const REFRESH_KEY = 'tf.refresh';
const safe = <T>(fn: () => T): T | undefined => {
  try {
    return fn();
  } catch {
    return undefined; // storage can be blocked (private mode)
  }
};

let accessToken: string | null = null;
export const tokens = {
  get refresh(): string | null {
    return safe(() => localStorage.getItem(REFRESH_KEY)) ?? null;
  },
  set(access: string | null, refresh: string | null) {
    accessToken = access;
    safe(() =>
      refresh ? localStorage.setItem(REFRESH_KEY, refresh) : localStorage.removeItem(REFRESH_KEY),
    );
  },
  clear() {
    this.set(null, null);
  },
};

export interface Session {
  user: { id: string; name: string; role: 'CUSTOMER' | 'ENGINEER' | 'ADMIN' };
  accessToken: string;
  refreshToken: string;
}

let refreshing: Promise<Session | null> | null = null;
/** One refresh at a time; null means the session is gone. */
export function refreshSession(): Promise<Session | null> {
  refreshing ??= (async () => {
    const refreshToken = tokens.refresh;
    if (!refreshToken) return null;
    try {
      const s = await raw<Session>('POST', '/auth/refresh', { refreshToken }, false);
      tokens.set(s.accessToken, s.refreshToken);
      return s;
    } catch {
      tokens.clear();
      return null;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

interface Opts {
  /** Sent as Idempotency-Key: a retry of the same attempt can never charge or confirm twice. */
  idempotencyKey?: string;
}

interface Page<T, M> {
  data: T;
  meta: M;
}

/** Like `raw`, but keeps the `meta` block (pagination, unread count). */
async function rawFull<T, M>(
  method: string,
  path: string,
  body: unknown,
  auth: boolean,
  opts: Opts = {},
): Promise<Page<T, M>> {
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(auth && accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(opts.idempotencyKey ? { 'Idempotency-Key': opts.idempotencyKey } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'UNAVAILABLE');
  }
  if (res.status === 204) return { data: undefined as T, meta: undefined as M };
  const json = (await res.json().catch(() => null)) as {
    data?: T;
    meta?: M;
    error?: { code: string; details?: { field: string; code: string }[] };
  } | null;
  if (!res.ok)
    throw new ApiError(res.status, json?.error?.code ?? 'INTERNAL', json?.error?.details ?? []);
  return { data: json?.data as T, meta: json?.meta as M };
}

async function raw<T>(
  method: string,
  path: string,
  body: unknown,
  auth: boolean,
  opts: Opts = {},
): Promise<T> {
  return (await rawFull<T, unknown>(method, path, body, auth, opts)).data;
}

/** Authenticated call; on an expired token it refreshes once and retries. */
export async function api<T>(
  method: string,
  path: string,
  body?: unknown,
  opts?: Opts,
): Promise<T> {
  try {
    return await raw<T>(method, path, body, true, opts);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401 && tokens.refresh && (await refreshSession())) {
      return raw<T>(method, path, body, true, opts);
    }
    throw e;
  }
}

/** Authenticated GET that also returns `meta` (e.g. the unread count). */
export async function apiPage<T, M>(path: string): Promise<Page<T, M>> {
  try {
    return await rawFull<T, M>('GET', path, undefined, true);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401 && tokens.refresh && (await refreshSession())) {
      return rawFull<T, M>('GET', path, undefined, true);
    }
    throw e;
  }
}

export const publicApi = <T>(method: string, path: string, body?: unknown) =>
  raw<T>(method, path, body, false);

export async function fetchServiceStatus(signal?: AbortSignal): Promise<'up' | 'down'> {
  try {
    const res = await fetch('/api/v1/health', { signal });
    return res.ok ? 'up' : 'down';
  } catch {
    return 'down';
  }
}
