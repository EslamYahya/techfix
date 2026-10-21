import { Body, Controller, HttpCode, Inject, Post, Req } from '@nestjs/common';
import type { Actor } from '@techfix/domain';
import { AuthService } from './auth.service.js';
import { CurrentActor, Public, type AuthedRequest } from './auth.decorators.js';

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  register(@Body() body: unknown, @Req() req: AuthedRequest) {
    return this.auth.register(body, req.ip ?? 'unknown');
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body() body: unknown, @Req() req: AuthedRequest) {
    return this.auth.login(body, req.ip ?? 'unknown');
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() body: unknown) {
    return this.auth.refresh(body);
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@CurrentActor() actor: Actor, @Body() body: unknown) {
    await this.auth.logout(actor.id, body);
  }
}
