/**
 * Every event that produces a notification. One list, so the API's rules and the web app's wording
 * are checked against the same source (a missing Arabic text fails a test, not a user).
 */
export const NOTIFICATION_TYPES = [
  'ENGINEER_SELECTED',
  'ENGINEER_CHANGED',
  'ENGINEER_ACCEPTED',
  'ENGINEER_REJECTED',
  'REQUEST_CANCELLED',
  'QUOTE_SENT',
  'QUOTE_ACCEPTED',
  'QUOTE_REJECTED',
  'EXTRA_QUOTE_SENT',
  'EXTRA_QUOTE_ACCEPTED',
  'EXTRA_QUOTE_REJECTED',
  'BOOKING_CONFIRMED',
  'TRIP_STARTED',
  'ARRIVED',
  'JOB_STARTED',
  'JOB_COMPLETED',
  'COMPLETION_CONFIRMED',
  'PAYMENT_PAID',
  'PAYMENT_FAILED',
  'CASH_RECEIVED',
  'REVIEWED',
  'PAYMENT_NEEDS_REVIEW',
  'REQUEST_CANCELLED_BY_ADMIN',
  'PAYMENT_REFUNDED',
  'DISPUTE_OPENED',
  'DISPUTE_RESOLVED',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
