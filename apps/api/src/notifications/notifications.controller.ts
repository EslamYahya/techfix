import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query } from '@nestjs/common';
import type { Actor } from '@techfix/domain';
import { CurrentActor } from '../auth/auth.decorators.js';
import { NotificationsService } from './notifications.service.js';

@Controller('notifications')
export class NotificationsController {
  constructor(@Inject(NotificationsService) private readonly svc: NotificationsService) {}

  @Get()
  list(@CurrentActor() a: Actor, @Query() q: { unread?: string; limit?: string; cursor?: string }) {
    return this.svc.list(a, q);
  }

  // Declared before `:id/read` so "read-all" is never taken for an id.
  @Post('read-all')
  @HttpCode(204)
  async readAll(@CurrentActor() a: Actor) {
    await this.svc.markAllRead(a);
  }

  @Post('devices')
  @HttpCode(204)
  async device(@CurrentActor() a: Actor, @Body() b: unknown) {
    await this.svc.registerDevice(a, b);
  }

  @Post(':id/read')
  @HttpCode(204)
  async read(@CurrentActor() a: Actor, @Param('id') id: string) {
    await this.svc.markRead(a, id);
  }
}
