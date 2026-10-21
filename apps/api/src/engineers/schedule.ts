import { DomainError } from '@techfix/domain';
import { z } from 'zod';
import type { ScheduleSlot } from '../repos.js';

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const ScheduleSchema = z.object({
  slots: z
    .array(z.object({ dayOfWeek: z.number().int().min(0).max(6), startTime: time, endTime: time }))
    .max(28),
});

/** Slots on the same day must be start<end and must not overlap. 0 = Sunday … 6 = Saturday. */
export function validateSchedule(slots: ScheduleSlot[]): ScheduleSlot[] {
  const bad = (code: string) =>
    new DomainError('VALIDATION_ERROR', 'Invalid schedule', [{ field: 'slots', code }]);
  const byDay = new Map<number, ScheduleSlot[]>();
  for (const s of slots) {
    if (s.startTime >= s.endTime) throw bad('start_after_end');
    byDay.set(s.dayOfWeek, [...(byDay.get(s.dayOfWeek) ?? []), s]);
  }
  for (const day of byDay.values()) {
    const sorted = [...day].sort((a, b) => a.startTime.localeCompare(b.startTime));
    for (let i = 1; i < sorted.length; i++)
      if (sorted[i]!.startTime < sorted[i - 1]!.endTime) throw bad('overlap');
  }
  return [...slots].sort(
    (a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime),
  );
}
