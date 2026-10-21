import { Body, Controller, Get, Inject, Patch, Post } from '@nestjs/common';
import type { Actor } from '@techfix/domain';
import { CurrentActor, Requires } from '../auth/auth.decorators.js';
import { CustomersService } from './customers.service.js';

@Controller('customers/me')
export class CustomersController {
  constructor(@Inject(CustomersService) private readonly svc: CustomersService) {}

  @Requires('profile.read')
  @Get()
  me(@CurrentActor() a: Actor) {
    return this.svc.me(a);
  }

  @Requires('profile.update')
  @Patch()
  update(@CurrentActor() a: Actor, @Body() b: unknown) {
    return this.svc.updateMe(a, b);
  }

  @Requires('profile.read')
  @Get('addresses')
  addresses(@CurrentActor() a: Actor) {
    return this.svc.addresses(a);
  }

  @Requires('profile.update')
  @Post('addresses')
  addAddress(@CurrentActor() a: Actor, @Body() b: unknown) {
    return this.svc.addAddress(a, b);
  }
}
