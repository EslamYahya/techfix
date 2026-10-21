import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Actor } from '@techfix/domain';
import type { Response } from 'express';
import { CurrentActor, Public, type AuthedRequest } from '../auth/auth.decorators.js';
import { IdempotencyService } from '../common/idempotency.service.js';
import { PaymentsService } from './payments.service.js';

const ctx = (a: Actor, req: AuthedRequest) => ({
  actorUserId: a.id,
  requestId: req.id ?? null,
  ip: req.ip ?? null,
});

@Controller()
export class PaymentsController {
  constructor(
    @Inject(PaymentsService) private readonly svc: PaymentsService,
    @Inject(IdempotencyService) private readonly idem: IdempotencyService,
  ) {}

  @Post('jobs/:id/payments')
  create(
    @CurrentActor() a: Actor,
    @Param('id') id: string,
    @Body() b: unknown,
    @Headers('idempotency-key') key: string | undefined,
    @Req() r: AuthedRequest,
  ) {
    return this.idem.run(a.id, `POST /jobs/${id}/payments`, key, b, () =>
      this.svc.create(a, id, b, ctx(a, r)),
    );
  }

  @Get('jobs/:id/payments')
  list(@CurrentActor() a: Actor, @Param('id') id: string) {
    return this.svc.list(a, id);
  }

  @HttpCode(200)
  @Post('jobs/:id/payments/confirm-cash')
  confirmCash(
    @CurrentActor() a: Actor,
    @Param('id') id: string,
    @Headers('idempotency-key') key: string | undefined,
    @Req() r: AuthedRequest,
  ) {
    return this.idem.run(a.id, `POST /jobs/${id}/payments/confirm-cash`, key, null, () =>
      this.svc.confirmCash(a, id, ctx(a, r)),
    );
  }

  /** Provider callback. No JWT: the signature is the credential. Fawry wants an empty 200 body. */
  @Public()
  @Post('payments/webhook')
  async webhook(@Body() b: unknown, @Res() res: Response) {
    await this.svc.handleWebhook(b);
    res.status(200).end();
  }

  @HttpCode(200)
  @Post('admin/payments/reconcile')
  reconcile(@CurrentActor() a: Actor, @Req() r: AuthedRequest) {
    return this.svc.reconcile(a, ctx(a, r));
  }
}
