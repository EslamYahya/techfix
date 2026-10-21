import { Inject, Injectable, Logger } from '@nestjs/common';
import { DomainError, authorize, type Actor, type NotificationType } from '@techfix/domain';
import { z } from 'zod';
import { clampLimit, decodeCursor, encodeCursor } from '../common/pagination.js';
import { parse } from '../common/zod.js';
import type { DomainEvent } from '../events/domain-events.js';
import { REPOS, type NotificationRecord, type OutboxRow, type Repos } from '../repos.js';
import { numberOf } from '../requests/requests.service.js';
import { NOTIFICATION_RULES } from './texts.js';

const isUuid = (s: string) => z.uuid().safeParse(s).success;
const DeviceSchema = z
  .object({ token: z.string().min(8).max(4096), platform: z.enum(['ANDROID', 'IOS', 'WEB']) })
  .strict();

const dto = (n: NotificationRecord) => ({
  id: n.id,
  type: n.type,
  title: n.title,
  body: n.body,
  data: n.data,
  read: n.readAt !== null,
  createdAt: n.createdAt.toISOString(),
});

/** Seconds to wait before the next try: 20, 40, 80 … capped at one hour. */
export const backoffSeconds = (attempts: number) => Math.min(3600, 10 * 2 ** Math.max(1, attempts));

@Injectable()
export class NotificationsService {
  private readonly log = new Logger('Notifications');
  constructor(@Inject(REPOS) private readonly repos: Repos) {}

  // ---- delivery (worker side) -------------------------------------------------------------

  /** Delivers one outbox row; on failure it is retried later with backoff. Safe to run twice. */
  async deliver(row: OutboxRow): Promise<'DELIVERED' | 'RETRY'> {
    try {
      await this.fanOut(row.payload as unknown as DomainEvent, row.id);
      await this.repos.outbox.markPublished(row.id);
      return 'DELIVERED';
    } catch (e) {
      this.log.warn(`outbox ${row.id} (${row.type}) failed: ${(e as Error).message}`);
      await this.repos.outbox.retryLater(row.id, backoffSeconds(row.attempts));
      return 'RETRY';
    }
  }

  async deliverById(id: string) {
    const row = await this.repos.outbox.get(id);
    if (row) await this.deliver(row);
  }

  /** The periodic safety net: everything due and never delivered. */
  async sweep(limit = 100) {
    const rows = await this.repos.outbox.lease(limit, 60);
    let delivered = 0;
    for (const r of rows) if ((await this.deliver(r)) === 'DELIVERED') delivered++;
    return { leased: rows.length, delivered };
  }

  private async fanOut(ev: DomainEvent, eventId: string) {
    const rule = (
      NOTIFICATION_RULES as Record<
        string,
        (typeof NOTIFICATION_RULES)[NotificationType] | undefined
      >
    )[ev.type];
    if (!rule) return; // an event type without a notification (e.g. REQUEST_CREATED) is simply done
    const agg = await this.repos.requests.get(ev.requestId);
    const who = await this.repos.notifications.recipientsOf(ev.requestId, ev.engineerId);
    if (!agg || !who) return;

    const ids =
      rule.to === 'ADMIN'
        ? await this.repos.notifications.adminUserIds()
        : [
            ...(rule.to === 'CUSTOMER' || rule.to === 'BOTH' ? [who.customerUserId] : []),
            ...((rule.to === 'ENGINEER' || rule.to === 'BOTH') && who.engineerUserId
              ? [who.engineerUserId]
              : []),
          ];
    const body = rule.body.replace('{n}', numberOf(agg.request.number));
    for (const userId of new Set(ids)) {
      if (userId === ev.actorUserId) continue;
      await this.repos.notifications.createOnce({
        userId,
        type: ev.type,
        title: rule.title,
        body,
        data: {
          eventId,
          requestId: ev.requestId,
          ...(ev.jobId ? { jobId: ev.jobId } : {}),
        },
      });
    }
  }

  // ---- reading (API side) -----------------------------------------------------------------

  async list(actor: Actor, q: { unread?: string; limit?: string; cursor?: string }) {
    authorize(actor, { permission: 'notifications.read.own' });
    const limit = clampLimit(q.limit);
    const cursor = decodeCursor(q.cursor);
    const rows = await this.repos.notifications.list(actor.id, {
      ...(q.unread === 'true' ? { unread: true } : {}),
      limit,
      ...(cursor ? { cursor } : {}),
    });
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    return {
      data: page.map(dto),
      meta: {
        nextCursor:
          rows.length > limit && last
            ? encodeCursor({ t: last.createdAt.toISOString(), id: last.id })
            : null,
        unreadCount: await this.repos.notifications.unreadCount(actor.id),
      },
    };
  }

  async markRead(actor: Actor, id: string) {
    authorize(actor, { permission: 'notifications.read.own' });
    // Someone else's notification is as good as missing.
    if (!isUuid(id) || !(await this.repos.notifications.markRead(actor.id, id)))
      throw new DomainError('NOT_FOUND');
  }

  async markAllRead(actor: Actor) {
    authorize(actor, { permission: 'notifications.read.own' });
    await this.repos.notifications.markAllRead(actor.id);
  }

  async registerDevice(actor: Actor, body: unknown) {
    authorize(actor, { permission: 'notifications.read.own' });
    await this.repos.notifications.saveDevice(actor.id, parse(DeviceSchema, body));
  }
}
