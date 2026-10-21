import { useState } from 'react';
import type { Quote } from '../api/types';
import { ITEM_TYPE, QUOTE_STATUS, QUOTE_UI } from '../labels';
import { Alert, Button, Card, Chip, Field, Select, TextArea, fieldErrors } from './kit';

export const money = (n: number) =>
  `${new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 2 }).format(n)} ${QUOTE_UI.currency}`;

/** A quote as both sides read it: items, the server-computed total and its state. */
export function QuoteView({
  quote,
  title,
  children,
}: {
  quote: Quote;
  title?: string;
  children?: React.ReactNode;
}) {
  const [label, tone] = QUOTE_STATUS[quote.status] ?? ['—', 'info' as const];
  return (
    <Card title={title ?? (quote.kind === 'MAIN' ? QUOTE_UI.title : QUOTE_UI.extraTitle)}>
      <div className="mb-2">
        <Chip tone={tone}>{label}</Chip>
      </div>
      <ul className="divide-y divide-line">
        {quote.items.map((i, n) => (
          <li key={n} className="flex flex-wrap justify-between gap-2 py-2">
            <span>
              {i.description}
              <span className="text-sm text-ink-3">
                {' '}
                · {ITEM_TYPE[i.type]} · {i.quantity} × {money(i.unitPrice)}
              </span>
            </span>
            <strong>{money(i.totalPrice)}</strong>
          </li>
        ))}
      </ul>
      <p className="mt-3 flex justify-between text-lg font-extrabold">
        <span>{QUOTE_UI.total}</span>
        <span>{money(quote.total)}</span>
      </p>
      <p className="text-sm text-ink-3">
        {QUOTE_UI.duration}: {quote.estimatedDurationMinutes} {QUOTE_UI.minutes}
      </p>
      {quote.notes ? <p className="mt-1 text-sm text-ink-2">{quote.notes}</p> : null}
      {quote.rejectionReason ? (
        <p className="mt-1 text-sm text-ink-3">سبب الرفض: {quote.rejectionReason}</p>
      ) : null}
      {children ? <div className="mt-3 flex flex-wrap gap-2">{children}</div> : null}
    </Card>
  );
}

interface Row {
  type: string;
  description: string;
  quantity: string;
  unitPrice: string;
}
const blank = (): Row => ({ type: 'LABOR', description: '', quantity: '1', unitPrice: '' });

/** The engineer enters items only. Any total shown here is a preview; the server computes the real one. */
export function QuoteForm({
  submitLabel,
  pending,
  error,
  onSubmit,
}: {
  submitLabel: string;
  pending: boolean;
  error: unknown;
  onSubmit: (body: {
    items: { type: string; description: string; quantity: number; unitPrice: number }[];
    estimatedDurationMinutes: number;
    notes?: string;
  }) => void;
}) {
  const [rows, setRows] = useState<Row[]>([blank()]);
  const [minutes, setMinutes] = useState('60');
  const [notes, setNotes] = useState('');
  const set = (i: number, k: keyof Row, v: string) =>
    setRows((r) => r.map((x, n) => (n === i ? { ...x, [k]: v } : x)));
  const preview = rows.reduce(
    (a, r) => a + (Number(r.quantity) || 0) * (Number(r.unitPrice) || 0),
    0,
  );
  const errs = fieldErrors(error);
  const itemsError = Object.keys(errs).some((k) => k.startsWith('items'))
    ? 'أضف بندًا واحدًا على الأقل بسعر وكمية صحيحين.'
    : undefined;
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          items: rows.map((r) => ({
            type: r.type,
            description: r.description,
            quantity: Number(r.quantity),
            unitPrice: Number(r.unitPrice),
          })),
          estimatedDurationMinutes: Number(minutes),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        });
      }}
    >
      {rows.map((r, i) => (
        <div key={i} className="grid gap-2 rounded-md border border-line p-3 sm:grid-cols-4">
          <Select
            label={QUOTE_UI.itemType}
            value={r.type}
            onChange={(e) => set(i, 'type', e.target.value)}
          >
            {Object.entries(ITEM_TYPE).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
          <div className="sm:col-span-3">
            <Field
              label={QUOTE_UI.itemDesc}
              value={r.description}
              onChange={(e) => set(i, 'description', e.target.value)}
              required
            />
          </div>
          <Field
            label={QUOTE_UI.quantity}
            type="number"
            min="0"
            step="any"
            value={r.quantity}
            onChange={(e) => set(i, 'quantity', e.target.value)}
            required
          />
          <Field
            label={QUOTE_UI.unitPrice}
            type="number"
            min="0"
            step="any"
            value={r.unitPrice}
            onChange={(e) => set(i, 'unitPrice', e.target.value)}
            required
          />
          {rows.length > 1 ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setRows((x) => x.filter((_, n) => n !== i))}
            >
              {QUOTE_UI.removeItem}
            </Button>
          ) : null}
        </div>
      ))}
      {itemsError ? <Alert>{itemsError}</Alert> : null}
      <Button type="button" variant="ghost" onClick={() => setRows((r) => [...r, blank()])}>
        {QUOTE_UI.addItem}
      </Button>
      <Field
        label={QUOTE_UI.estimate}
        type="number"
        min="1"
        value={minutes}
        onChange={(e) => setMinutes(e.target.value)}
        error={errs['estimatedDurationMinutes']}
        required
      />
      <TextArea label={QUOTE_UI.notes} value={notes} onChange={(e) => setNotes(e.target.value)} />
      <p className="text-sm text-ink-3">
        {QUOTE_UI.preview}: <strong>{money(preview)}</strong>
      </p>
      {error && !itemsError && Object.keys(errs).length === 0 ? (
        <Alert>{(error as Error).message}</Alert>
      ) : null}
      <Button type="submit" disabled={pending}>
        {submitLabel}
      </Button>
    </form>
  );
}
