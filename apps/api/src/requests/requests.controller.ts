import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query, Req } from '@nestjs/common';
import type { Actor } from '@techfix/domain';
import { CurrentActor, type AuthedRequest } from '../auth/auth.decorators.js';
import { RequestsService } from './requests.service.js';

const ctx = (actor: Actor, req: AuthedRequest) => ({
  actorUserId: actor.id,
  requestId: req.id ?? null,
  ip: req.ip ?? null,
});
type ListQuery = { status?: string; limit?: string; cursor?: string };

/** Authorization lives in the service (permission → ownership → state) because several roles share these routes. */
@Controller()
export class RequestsController {
  constructor(@Inject(RequestsService) private readonly svc: RequestsService) {}

  @Post('service-requests')
  create(@CurrentActor() a: Actor, @Body() b: unknown, @Req() req: AuthedRequest) {
    return this.svc.create(a, b, ctx(a, req));
  }

  @Get('service-requests')
  list(@CurrentActor() a: Actor, @Query() q: ListQuery) {
    return this.svc.listMine(a, q);
  }

  @Get('engineer/requests')
  assigned(@CurrentActor() a: Actor, @Query() q: ListQuery) {
    return this.svc.listAssigned(a, q);
  }

  @Get('service-requests/:id')
  detail(@CurrentActor() a: Actor, @Param('id') id: string) {
    return this.svc.detail(a, id);
  }

  @Get('service-requests/:id/recommendations')
  recommendations(@CurrentActor() a: Actor, @Param('id') id: string) {
    return this.svc.recommendations(a, id);
  }

  @HttpCode(200)
  @Post('service-requests/:id/select-engineer')
  select(
    @CurrentActor() a: Actor,
    @Param('id') id: string,
    @Body() b: unknown,
    @Req() req: AuthedRequest,
  ) {
    return this.svc.selectEngineer(a, id, b, ctx(a, req));
  }

  @HttpCode(200)
  @Post('service-requests/:id/change-engineer')
  change(@CurrentActor() a: Actor, @Param('id') id: string, @Req() req: AuthedRequest) {
    return this.svc.changeEngineer(a, id, ctx(a, req));
  }

  @HttpCode(200)
  @Post('service-requests/:id/accept')
  accept(@CurrentActor() a: Actor, @Param('id') id: string, @Req() req: AuthedRequest) {
    return this.svc.accept(a, id, ctx(a, req));
  }

  @HttpCode(200)
  @Post('service-requests/:id/reject')
  reject(
    @CurrentActor() a: Actor,
    @Param('id') id: string,
    @Body() b: unknown,
    @Req() req: AuthedRequest,
  ) {
    return this.svc.reject(a, id, b, ctx(a, req));
  }

  @HttpCode(200)
  @Post('service-requests/:id/cancel')
  cancel(
    @CurrentActor() a: Actor,
    @Param('id') id: string,
    @Body() b: unknown,
    @Req() req: AuthedRequest,
  ) {
    return this.svc.cancel(a, id, b, ctx(a, req));
  }
}
