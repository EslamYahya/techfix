import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DomainError, authorize, type Actor, type Permission } from '@techfix/domain';
import { REPOS, type Repos } from '../repos.js';
import { IS_PUBLIC, REQUIRES, type AuthedRequest } from './auth.decorators.js';
import { TokenService } from './token.service.js';

/** Global guard: bearer token → live account → Actor → permission check. Public routes skip it. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(TokenService) private readonly tokens: TokenService,
    @Inject(REPOS) private readonly repos: Repos,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const header = req.header('authorization') ?? '';
    const m = /^Bearer (.+)$/.exec(header);
    if (!m?.[1]) throw new DomainError('UNAUTHORIZED');

    const claims = await this.tokens.verifyAccess(m[1]);
    const account = await this.repos.identity.findById(claims.sub);
    if (!account) throw new DomainError('UNAUTHORIZED');

    const actor: Actor = {
      id: account.user.id,
      role: account.user.role,
      userStatus: account.user.status,
      ...((account.engineerId ?? account.customerId)
        ? { profileId: (account.engineerId ?? account.customerId)! }
        : {}),
      ...(account.verification ? { verification: account.verification } : {}),
    };
    req.actor = actor;

    const permission = this.reflector.getAllAndOverride<Permission | undefined>(REQUIRES, targets);
    if (permission) authorize(actor, { permission });
    else if (actor.userStatus === 'SUSPENDED') throw new DomainError('ACCOUNT_SUSPENDED');
    return true;
  }
}
