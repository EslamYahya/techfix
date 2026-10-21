import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import { ApiError } from '../api/http';
import { fieldMessage, UI } from '../labels';

type Tone = 'info' | 'warn' | 'ok' | 'bad' | 'live';
const TONES: Record<Tone, string> = {
  info: 'bg-brand-soft text-brand-strong',
  warn: 'bg-warn-soft text-warn',
  ok: 'bg-ok-soft text-ok',
  bad: 'bg-bad-soft text-bad',
  live: 'bg-teal-soft text-teal',
};

export const Chip = ({ tone, children }: { tone: Tone; children: ReactNode }) => (
  <span className={`inline-block rounded-md px-2 py-0.5 text-sm font-semibold ${TONES[tone]}`}>
    {children}
  </span>
);

export function Button({
  variant = 'primary',
  className = '',
  ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' }) {
  const v = {
    primary: 'bg-brand text-white hover:bg-brand-strong',
    ghost: 'border border-line bg-surface text-ink hover:bg-surface-2',
    danger: 'bg-bad text-white hover:opacity-90',
  }[variant];
  return (
    <button
      {...p}
      className={`rounded-md px-4 py-2 font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${v} ${className}`}
    />
  );
}

export function Field({
  label,
  error,
  ...p
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-ink-2">{label}</span>
      <input
        {...p}
        aria-invalid={error ? true : undefined}
        className="w-full rounded-md border border-line bg-surface px-3 py-2 text-ink outline-none focus:border-teal"
      />
      {error ? <span className="mt-1 block text-sm text-bad">{error}</span> : null}
    </label>
  );
}

export const Card = ({ title, children }: { title?: string; children: ReactNode }) => (
  <section className="rounded-lg border border-line bg-surface p-5 shadow-sm">
    {title ? <h2 className="mb-3 text-lg font-bold">{title}</h2> : null}
    {children}
  </section>
);

export const Alert = ({ tone = 'bad', children }: { tone?: Tone; children: ReactNode }) => (
  <p
    role={tone === 'bad' ? 'alert' : 'status'}
    className={`rounded-md px-3 py-2 text-sm ${TONES[tone]}`}
  >
    {children}
  </p>
);

export const Loading = () => (
  <p role="status" className="py-8 text-center text-ink-3">
    {UI.loading}
  </p>
);

export const Empty = ({ children }: { children: ReactNode }) => (
  <p className="rounded-md bg-surface-2 px-4 py-6 text-center text-ink-3">{children}</p>
);

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="space-y-3 py-6 text-center">
      <Alert>{error instanceof ApiError ? error.message : 'حدث خطأ غير متوقع.'}</Alert>
      {onRetry ? (
        <Button variant="ghost" onClick={onRetry}>
          {UI.retry}
        </Button>
      ) : null}
    </div>
  );
}

/** Field-level messages from a validation error, keyed by field. */
export function fieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError)) return {};
  const out: Record<string, string> = {};
  for (const d of error.details) out[d.field] ??= fieldMessage(d.field, d.code) ?? error.message;
  return out;
}

export const Shell = ({ children, wide = false }: { children: ReactNode; wide?: boolean }) => (
  <main className={`mx-auto px-4 py-10 ${wide ? 'max-w-4xl' : 'max-w-md'}`}>{children}</main>
);

const CONTROL =
  'w-full rounded-md border border-line bg-surface px-3 py-2 text-ink outline-none focus:border-teal';

export function TextArea({
  label,
  error,
  ...p
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; error?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-ink-2">{label}</span>
      <textarea {...p} aria-invalid={error ? true : undefined} className={CONTROL} rows={4} />
      {error ? <span className="mt-1 block text-sm text-bad">{error}</span> : null}
    </label>
  );
}

export function Select({
  label,
  error,
  children,
  ...p
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; error?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-ink-2">{label}</span>
      <select {...p} aria-invalid={error ? true : undefined} className={CONTROL}>
        {children}
      </select>
      {error ? <span className="mt-1 block text-sm text-bad">{error}</span> : null}
    </label>
  );
}
