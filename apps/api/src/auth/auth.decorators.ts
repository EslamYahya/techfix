import { SetMetadata, createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Actor, Permission } from '@techfix/domain';
import type { Request } from 'express';

export const IS_PUBLIC = 'tf:public';
export const REQUIRES = 'tf:requires';

/** No login needed. */
export const Public = () => SetMetadata(IS_PUBLIC, true);
/** Login + this permission (Permission + account health are checked by `authorize()` in the guard). */
export const Requires = (permission: Permission) => SetMetadata(REQUIRES, permission);

export type AuthedRequest = Request & { actor?: Actor; id?: string };

export const CurrentActor = createParamDecorator((_: unknown, ctx: ExecutionContext): Actor => {
  const req = ctx.switchToHttp().getRequest<AuthedRequest>();
  return req.actor as Actor;
});
