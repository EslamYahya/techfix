import { Body, Controller, Get, Inject, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { Actor } from '@techfix/domain';
import { CurrentActor, Public, Requires, type AuthedRequest } from '../auth/auth.decorators.js';
import { CatalogService } from './catalog.service.js';

const ctx = (actor: Actor, req: AuthedRequest) => ({
  actorUserId: actor.id,
  requestId: req.id ?? null,
  ip: req.ip ?? null,
});

@Controller()
export class CatalogController {
  constructor(@Inject(CatalogService) private readonly catalog: CatalogService) {}

  @Public()
  @Get('service-categories')
  categories() {
    return this.catalog.categories();
  }

  @Public()
  @Get('services')
  services(@Query('category') category?: string) {
    return this.catalog.services(category);
  }

  @Public()
  @Get('services/:serviceId')
  service(@Param('serviceId') id: string) {
    return this.catalog.service(id);
  }

  @Requires('services.manage')
  @Post('admin/services')
  create(@Body() body: unknown, @CurrentActor() actor: Actor, @Req() req: AuthedRequest) {
    return this.catalog.create(body, ctx(actor, req));
  }

  @Requires('services.manage')
  @Patch('admin/services/:serviceId')
  update(
    @Param('serviceId') id: string,
    @Body() body: unknown,
    @CurrentActor() actor: Actor,
    @Req() req: AuthedRequest,
  ) {
    return this.catalog.update(id, body, ctx(actor, req));
  }
}
