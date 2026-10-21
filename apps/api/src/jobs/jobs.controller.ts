import { Body, Controller, Get, HttpCode, Inject, Param, Post, Req } from '@nestjs/common';
import type { Actor } from '@techfix/domain';
import { CurrentActor, type AuthedRequest } from '../auth/auth.decorators.js';
import { JobsService, type StepName } from './jobs.service.js';

const ctx = (a: Actor, req: AuthedRequest) => ({
  actorUserId: a.id,
  requestId: req.id ?? null,
  ip: req.ip ?? null,
});

@Controller('jobs')
export class JobsController {
  constructor(@Inject(JobsService) private readonly svc: JobsService) {}

  @Get(':id')
  get(@CurrentActor() a: Actor, @Param('id') id: string) {
    return this.svc.get(a, id);
  }

  private step(a: Actor, id: string, name: StepName, r: AuthedRequest) {
    return this.svc.step(a, id, name, ctx(a, r));
  }

  @HttpCode(200)
  @Post(':id/start-trip')
  startTrip(@CurrentActor() a: Actor, @Param('id') id: string, @Req() r: AuthedRequest) {
    return this.step(a, id, 'startTrip', r);
  }

  @HttpCode(200)
  @Post(':id/arrive')
  arrive(@CurrentActor() a: Actor, @Param('id') id: string, @Req() r: AuthedRequest) {
    return this.step(a, id, 'arrive', r);
  }

  @HttpCode(200)
  @Post(':id/start')
  start(@CurrentActor() a: Actor, @Param('id') id: string, @Req() r: AuthedRequest) {
    return this.step(a, id, 'start', r);
  }

  @HttpCode(200)
  @Post(':id/complete')
  complete(@CurrentActor() a: Actor, @Param('id') id: string, @Req() r: AuthedRequest) {
    return this.step(a, id, 'complete', r);
  }

  @HttpCode(200)
  @Post(':id/confirm-completion')
  confirm(@CurrentActor() a: Actor, @Param('id') id: string, @Req() r: AuthedRequest) {
    return this.step(a, id, 'confirmCompletion', r);
  }

  @Post(':id/report-problem')
  report(
    @CurrentActor() a: Actor,
    @Param('id') id: string,
    @Body() b: unknown,
    @Req() r: AuthedRequest,
  ) {
    return this.svc.reportProblem(a, id, b, ctx(a, r));
  }
}
