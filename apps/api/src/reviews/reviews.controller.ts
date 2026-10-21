import { Body, Controller, Get, Inject, Param, Post, Query, Req } from '@nestjs/common';
import type { Actor } from '@techfix/domain';
import { CurrentActor, type AuthedRequest } from '../auth/auth.decorators.js';
import { ReviewsService } from './reviews.service.js';

@Controller()
export class ReviewsController {
  constructor(@Inject(ReviewsService) private readonly svc: ReviewsService) {}

  @Post('jobs/:id/review')
  create(
    @CurrentActor() a: Actor,
    @Param('id') id: string,
    @Body() b: unknown,
    @Req() r: AuthedRequest,
  ) {
    return this.svc.create(a, id, b, {
      actorUserId: a.id,
      requestId: r.id ?? null,
      ip: r.ip ?? null,
    });
  }

  @Get('engineers/:engineerId/reviews')
  list(
    @CurrentActor() a: Actor,
    @Param('engineerId') engineerId: string,
    @Query() q: { limit?: string; cursor?: string },
  ) {
    return this.svc.listForEngineer(a, engineerId, q);
  }
}
