import { describe, it, expect } from 'vitest';
import {
  transition,
  allowedEvents,
  REQUEST_STATUSES,
  TRANSITIONS,
  DomainError,
} from '../src/index';

const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return (e as DomainError).code;
  }
  return null;
};

describe('request state machine', () => {
  it('walks the full happy path (cash) exactly as the prototype does', () => {
    let s = transition('REQUESTED', 'START_MATCHING', 'SYSTEM');
    const steps: [Parameters<typeof transition>[1], Parameters<typeof transition>[2], string][] = [
      ['SELECT_ENGINEER', 'CUSTOMER', 'ENGINEER_SELECTED'],
      ['ENGINEER_ACCEPT', 'ENGINEER', 'ENGINEER_ACCEPTED'],
      ['SEND_QUOTE', 'ENGINEER', 'QUOTE_SENT'],
      ['ACCEPT_QUOTE', 'CUSTOMER', 'QUOTE_ACCEPTED'],
      ['CONFIRM_BOOKING', 'CUSTOMER', 'CONFIRMED'],
      ['START_TRIP', 'ENGINEER', 'ON_THE_WAY'],
      ['ARRIVE', 'ENGINEER', 'ARRIVED'],
      ['START_JOB', 'ENGINEER', 'IN_PROGRESS'],
      ['COMPLETE_JOB', 'ENGINEER', 'COMPLETION_PENDING'],
      ['CONFIRM_COMPLETION', 'CUSTOMER', 'COMPLETED'],
      ['RATE', 'CUSTOMER', 'RATED'],
    ];
    expect(s).toBe('MATCHING');
    for (const [ev, who, to] of steps) {
      s = transition(s, ev, who);
      expect(s).toBe(to);
    }
  });

  it('engineer reject / timeout / customer change all return to MATCHING', () => {
    expect(transition('ENGINEER_SELECTED', 'ENGINEER_REJECT', 'ENGINEER')).toBe('MATCHING');
    expect(transition('ENGINEER_SELECTED', 'ENGINEER_TIMEOUT', 'SYSTEM')).toBe('MATCHING');
    expect(transition('QUOTE_SENT', 'CHANGE_ENGINEER', 'CUSTOMER')).toBe('MATCHING');
  });

  it('a rejected quote can be revised by the engineer', () => {
    expect(transition('QUOTE_SENT', 'REJECT_QUOTE', 'CUSTOMER')).toBe('QUOTE_REJECTED');
    expect(transition('QUOTE_REJECTED', 'SEND_QUOTE', 'ENGINEER')).toBe('QUOTE_SENT');
  });

  it('rejects wrong actor with FORBIDDEN and wrong state with INVALID_STATE_TRANSITION', () => {
    expect(code(() => transition('CONFIRMED', 'START_TRIP', 'CUSTOMER'))).toBe('FORBIDDEN');
    expect(code(() => transition('COMPLETED', 'START_TRIP', 'ENGINEER'))).toBe(
      'INVALID_STATE_TRANSITION',
    );
    expect(code(() => transition('QUOTE_SENT', 'ACCEPT_QUOTE', 'ENGINEER'))).toBe('FORBIDDEN');
  });

  it('only the system may start matching or time out', () => {
    expect(code(() => transition('REQUESTED', 'START_MATCHING', 'CUSTOMER'))).toBe('FORBIDDEN');
    expect(code(() => transition('ENGINEER_SELECTED', 'ENGINEER_TIMEOUT', 'ENGINEER'))).toBe(
      'FORBIDDEN',
    );
  });

  it('cancellation: free until CONFIRMED, admin-only once the engineer is moving', () => {
    expect(transition('CONFIRMED', 'CANCEL', 'CUSTOMER')).toBe('CANCELLED');
    expect(code(() => transition('ON_THE_WAY', 'CANCEL', 'CUSTOMER'))).toBe(
      'INVALID_STATE_TRANSITION',
    );
    expect(transition('IN_PROGRESS', 'CANCEL', 'ADMIN')).toBe('CANCELLED');
    expect(code(() => transition('COMPLETED', 'CANCEL', 'ADMIN'))).toBe('INVALID_STATE_TRANSITION');
    expect(code(() => transition('RATED', 'CANCEL', 'CUSTOMER'))).toBe('INVALID_STATE_TRANSITION');
    expect(code(() => transition('REQUESTED', 'CANCEL', 'ENGINEER'))).toBe('FORBIDDEN');
  });

  it('every non-terminal status has at least one exit, terminal ones have none', () => {
    for (const s of REQUEST_STATUSES) {
      const outs = (['CUSTOMER', 'ENGINEER', 'ADMIN', 'SYSTEM'] as const).flatMap((r) =>
        allowedEvents(s, r),
      );
      if (s === 'RATED' || s === 'CANCELLED') expect(outs).toEqual([]);
      else expect(outs.length, s).toBeGreaterThan(0);
    }
  });

  it('only transitions that exist in the table can reach a status', () => {
    const reachable = new Set(Object.values(TRANSITIONS).map((r) => r.to));
    for (const s of REQUEST_STATUSES)
      if (s !== 'REQUESTED' && s !== 'CANCELLED') expect(reachable.has(s), s).toBe(true);
  });
});
