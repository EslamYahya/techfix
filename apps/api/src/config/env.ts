import { z } from 'zod';

const optionalEnv = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema.optional());

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    STORE: z.enum(['postgres', 'memory']).default('postgres'),
    DATABASE_URL: z.string().min(1).optional(),
    REDIS_URL: z.string().min(1).optional(),
    /** Redis key prefix of the job queue, so several environments can share one Redis. */
    QUEUE_PREFIX: z.string().min(1).default('techfix'),
    CORS_ORIGIN: z.string().default('http://localhost:5173'),
    /** Number of reverse proxies in front of the API (nginx = 1). Needed for the real client IP in logs, audit and rate limits. */
    TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    JWT_ACCESS_SECRET: z.string().min(32),
    ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(15),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
    AUTH_LOGIN_MAX_PER_15MIN: z.coerce.number().int().positive().default(10),
    AUTH_REGISTER_MAX_PER_HOUR: z.coerce.number().int().positive().default(20),
    // Fawry (online payment). All three of MERCHANT_CODE / SECURITY_KEY / BASE_URL enable it; otherwise only cash works.
    FAWRY_MERCHANT_CODE: optionalEnv(z.string().min(1)),
    FAWRY_SECURITY_KEY: optionalEnv(z.string().min(1)),
    FAWRY_BASE_URL: optionalEnv(z.url()),
    FAWRY_WEBHOOK_URL: optionalEnv(z.url()),
    FAWRY_FALLBACK_EMAIL: z.string().default('no-reply@techfix.invalid'),
    /** How long a Fawry reference can be paid. OPEN DECISION (24h placeholder). */
    PAYMENT_EXPIRY_HOURS: z.coerce.number().positive().default(24),
    /** Pending online payments older than this are checked against the provider by reconciliation. */
    PAYMENT_RECONCILE_AFTER_MINUTES: z.coerce.number().min(0).default(30),
    /** Background jobs (outbox sweep, payment reconciliation). Off by default in tests; API-only replicas set false. */
    RUN_WORKERS: z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => (v === undefined ? undefined : v === 'true')),
    OUTBOX_SWEEP_INTERVAL_SECONDS: z.coerce.number().positive().default(15),
    PAYMENT_RECONCILE_INTERVAL_MINUTES: z.coerce.number().positive().default(10),
    IDEMPOTENCY_TTL_HOURS: z.coerce.number().positive().default(24),
    SEED_ADMIN_PHONE: z.string().optional(),
    SEED_ADMIN_PASSWORD: z.string().min(8).optional(),
    SEED_ADMIN_NAME: z.string().default('مشرف المنصة'),
  })
  .refine(
    (e) =>
      [e.FAWRY_MERCHANT_CODE, e.FAWRY_SECURITY_KEY, e.FAWRY_BASE_URL].every(Boolean) ||
      [e.FAWRY_MERCHANT_CODE, e.FAWRY_SECURITY_KEY, e.FAWRY_BASE_URL].every((v) => !v),
    {
      path: ['FAWRY_MERCHANT_CODE'],
      message: 'FAWRY_MERCHANT_CODE, FAWRY_SECURITY_KEY and FAWRY_BASE_URL go together',
    },
  )
  .superRefine((e, ctx) => {
    if (e.NODE_ENV !== 'production') return;
    const add = (path: string, message: string) =>
      ctx.addIssue({ code: 'custom', path: [path], message });
    if (e.STORE !== 'postgres')
      add('STORE', 'production needs STORE=postgres (memory loses everything on restart)');
    if (/change-me|example|secret/i.test(e.JWT_ACCESS_SECRET))
      add('JWT_ACCESS_SECRET', 'replace the placeholder secret (openssl rand -base64 48)');
    if (/localhost|127\.0\.0\.1/.test(e.CORS_ORIGIN))
      add('CORS_ORIGIN', 'set the public web origin, not localhost');
    if (e.SEED_ADMIN_PASSWORD && /change-me/i.test(e.SEED_ADMIN_PASSWORD))
      add('SEED_ADMIN_PASSWORD', 'replace the placeholder admin password');
  })
  .refine((e) => e.STORE === 'memory' || !!e.DATABASE_URL, {
    path: ['DATABASE_URL'],
    message: 'required when STORE=postgres',
  });

export type Env = Omit<z.infer<typeof schema>, 'RUN_WORKERS'> & { RUN_WORKERS: boolean };
export const ENV = Symbol('ENV');

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment: ${issues}`);
  }
  const d = parsed.data;
  return { ...d, RUN_WORKERS: d.RUN_WORKERS ?? d.NODE_ENV !== 'test' };
}
