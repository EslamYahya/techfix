import { Body, Controller, Get, HttpCode, Inject, Param, Post, Req } from '@nestjs/common';
import type { Actor } from '@techfix/domain';
import { CurrentActor, type AuthedRequest } from '../auth/auth.decorators.js';
import { QuotesService } from './quotes.service.js';

const ctx = (a: Actor, req: AuthedRequest) => ({
  actorUserId: a.id,
  requestId: req.id ?? null,
  ip: req.ip ?? null,
});

@Controller()
export class QuotesController {
  constructor(@Inject(QuotesService) private readonly svc: QuotesService) {}

  @Post('service-requests/:id/quotes')
  send(
    @CurrentActor() a: Actor,
    @Param('id') id: string,
    @Body() b: unknown,
    @Req() r: AuthedRequest,
  ) {
    return this.svc.sendMain(a, id, b, ctx(a, r));
  }

  @Get('service-requests/:id/quotes')
  list(@CurrentActor() a: Actor, @Param('id') id: string) {
    return this.svc.list(a, id);
  }

  @HttpCode(200)
  @Post('quotes/:id/accept')
  accept(@CurrentActor() a: Actor, @Param('id') id: string, @Req() r: AuthedRequest) {
    return this.svc.acceptMain(a, id, ctx(a, r));
  }

  @HttpCode(200)
  @Post('quotes/:id/reject')
  reject(
    @CurrentActor() a: Actor,
    @Param('id') id: string,
    @Body() b: unknown,
    @Req() r: AuthedRequest,
  ) {
    return this.svc.rejectMain(a, id, b, ctx(a, r));
  }

  @Post('jobs/:id/additional-quotes')
  additional(
    @CurrentActor() a: Actor,
    @Param('id') id: string,
    @Body() b: unknown,
    @Req() r: AuthedRequest,
  ) {
    return this.svc.sendAdditional(a, id, b, ctx(a, r));
  }

  @HttpCode(200)
  @Post('additional-quotes/:id/accept')
  acceptExtra(@CurrentActor() a: Actor, @Param('id') id: string, @Req() r: AuthedRequest) {
    return this.svc.decideAdditional(a, id, true, undefined, ctx(a, r));
  }

  @HttpCode(200)
  @Post('additional-quotes/:id/reject')
  rejectExtra(
    @CurrentActor() a: Actor,
    @Param('id') id: string,
    @Body() b: unknown,
    @Req() r: AuthedRequest,
  ) {
    return this.svc.decideAdditional(a, id, false, b, ctx(a, r));
  }
}
