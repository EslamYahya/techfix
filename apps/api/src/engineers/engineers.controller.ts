import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import type { Actor } from '@techfix/domain';
import { CurrentActor, Requires, type AuthedRequest } from '../auth/auth.decorators.js';
import { EngineersService } from './engineers.service.js';

const ctx = (actor: Actor, req: AuthedRequest) => ({
  actorUserId: actor.id,
  requestId: req.id ?? null,
  ip: req.ip ?? null,
});

@Controller()
export class EngineersController {
  constructor(@Inject(EngineersService) private readonly svc: EngineersService) {}

  // — the engineer's own profile (declared before `engineers/:engineerId`) —
  @Requires('profile.read')
  @Get('engineers/me')
  me(@CurrentActor() a: Actor) {
    return this.svc.me(a);
  }

  @Requires('profile.update')
  @Patch('engineers/me')
  updateMe(@CurrentActor() a: Actor, @Body() b: unknown) {
    return this.svc.updateMe(a, b);
  }

  @Requires('profile.update')
  @Post('engineers/me/documents')
  addDocument(@CurrentActor() a: Actor, @Body() b: unknown) {
    return this.svc.addDocument(a, b);
  }

  @Requires('availability.manage.own')
  @Patch('engineers/me/status')
  setStatus(@CurrentActor() a: Actor, @Body() b: unknown) {
    return this.svc.setStatus(a, b);
  }

  @Requires('availability.manage.own')
  @Get('engineers/me/availability')
  schedule(@CurrentActor() a: Actor) {
    return this.svc.schedule(a);
  }

  @Requires('availability.manage.own')
  @Put('engineers/me/availability')
  replaceSchedule(@CurrentActor() a: Actor, @Body() b: unknown) {
    return this.svc.replaceSchedule(a, b);
  }

  @Requires('location.manage.own')
  @Patch('engineers/me/location')
  setLocation(@CurrentActor() a: Actor, @Body() b: unknown) {
    return this.svc.setLocation(a, b);
  }

  @Requires('services.manage.own')
  @Get('engineers/me/services')
  services(@CurrentActor() a: Actor) {
    return this.svc.services(a);
  }

  @Requires('services.manage.own')
  @Post('engineers/me/services')
  addService(@CurrentActor() a: Actor, @Body() b: unknown) {
    return this.svc.addService(a, b);
  }

  @Requires('services.manage.own')
  @Delete('engineers/me/services/:serviceId')
  @HttpCode(204)
  async removeService(@CurrentActor() a: Actor, @Param('serviceId') id: string) {
    await this.svc.removeService(a, id);
  }

  // — what customers see —
  @Requires('engineers.read')
  @Get('engineers/:engineerId')
  card(@Param('engineerId') id: string) {
    return this.svc.publicCard(id);
  }

  // — admin —
  @Requires('engineers.read')
  @Get('admin/engineers')
  adminList(@Query() q: { verification?: string; limit?: string; cursor?: string }) {
    return this.svc.adminList(q);
  }

  @Requires('engineers.verify')
  @Post('admin/engineers/:engineerId/verify')
  @HttpCode(200)
  verify(
    @Param('engineerId') id: string,
    @Body() b: unknown,
    @CurrentActor() a: Actor,
    @Req() r: AuthedRequest,
  ) {
    return this.svc.verify(id, b, ctx(a, r));
  }

  @Requires('engineers.suspend')
  @Post('admin/engineers/:engineerId/suspend')
  @HttpCode(200)
  suspend(@Param('engineerId') id: string, @CurrentActor() a: Actor, @Req() r: AuthedRequest) {
    return this.svc.suspend(id, ctx(a, r));
  }

  @Requires('engineers.suspend')
  @Post('admin/engineers/:engineerId/reinstate')
  @HttpCode(200)
  reinstate(@Param('engineerId') id: string, @CurrentActor() a: Actor, @Req() r: AuthedRequest) {
    return this.svc.reinstate(id, ctx(a, r));
  }
}
