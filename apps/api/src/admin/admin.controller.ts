import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query, Req } from '@nestjs/common';
import type { Actor } from '@techfix/domain';
import { CurrentActor, type AuthedRequest } from '../auth/auth.decorators.js';
import { AdminService } from './admin.service.js';

const ctx = (a: Actor, r: AuthedRequest) => ({
  actorUserId: a.id,
  requestId: r.id ?? null,
  ip: r.ip ?? null,
});

@Controller()
export class AdminController {
  constructor(@Inject(AdminService) private readonly svc: AdminService) {}

  @Get('admin/service-requests')
  requests(
    @CurrentActor() a: Actor,
    @Query() q: { status?: string; hasDispute?: string; limit?: string; cursor?: string },
  ) {
    return this.svc.listRequests(a, q);
  }

  @Post('admin/service-requests/:id/cancel')
  @HttpCode(200)
  cancel(
    @CurrentActor() a: Actor,
    @Param('id') id: string,
    @Body() b: unknown,
    @Req() r: AuthedRequest,
  ) {
    return this.svc.cancelRequest(a, id, b, ctx(a, r));
  }

  @Get('admin/payments')
  payments(
    @CurrentActor() a: Actor,
    @Query() q: { status?: string; method?: string; limit?: string; cursor?: string },
  ) {
    return this.svc.listPayments(a, q);
  }

  @Post('payments/:id/refund')
  @HttpCode(200)
  refund(
    @CurrentActor() a: Actor,
    @Param('id') id: string,
    @Body() b: unknown,
    @Req() r: AuthedRequest,
  ) {
    return this.svc.refund(a, id, b, ctx(a, r));
  }

  @Get('admin/disputes')
  disputes(
    @CurrentActor() a: Actor,
    @Query() q: { status?: string; limit?: string; cursor?: string },
  ) {
    return this.svc.listDisputes(a, q);
  }

  @Post('admin/disputes/:id/resolve')
  @HttpCode(200)
  resolve(
    @CurrentActor() a: Actor,
    @Param('id') id: string,
    @Body() b: unknown,
    @Req() r: AuthedRequest,
  ) {
    return this.svc.resolveDispute(a, id, b, ctx(a, r));
  }

  @Get('admin/reviews')
  reviews(
    @CurrentActor() a: Actor,
    @Query() q: { hidden?: string; limit?: string; cursor?: string },
  ) {
    return this.svc.listReviews(a, q);
  }

  @Post('admin/reviews/:id/hide')
  @HttpCode(200)
  hide(
    @CurrentActor() a: Actor,
    @Param('id') id: string,
    @Body() b: unknown,
    @Req() r: AuthedRequest,
  ) {
    return this.svc.hideReview(a, id, b, ctx(a, r));
  }
}
