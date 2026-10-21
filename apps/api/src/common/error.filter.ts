import { ArgumentsHost, Catch, HttpException, Logger, type ExceptionFilter } from '@nestjs/common';
import { DomainError, ERROR_HTTP, type ErrorCode } from '@techfix/domain';
import type { Request, Response } from 'express';

const BY_STATUS: Record<number, ErrorCode> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'VALIDATION_ERROR',
  429: 'RATE_LIMITED',
  503: 'UNAVAILABLE',
};

/** One error shape for the whole API: { error: { code, message, details, requestId } }. */
@Catch()
export class ErrorFilter implements ExceptionFilter {
  private readonly log = new Logger('ErrorFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const res = http.getResponse<Response>();
    const req = http.getRequest<Request & { id?: string }>();

    let code: ErrorCode = 'INTERNAL';
    let message = 'Internal error';
    let details: unknown[] = [];

    if (exception instanceof DomainError) {
      code = exception.code;
      message = exception.message;
      details = exception.details;
    } else if (exception instanceof HttpException) {
      code = BY_STATUS[exception.getStatus()] ?? 'INTERNAL';
      message = exception.message;
    }

    // Never leak internals for unexpected errors.
    if (code === 'INTERNAL') {
      message = 'Internal error';
      this.log.error(
        exception instanceof Error ? (exception.stack ?? exception.message) : String(exception),
      );
    }

    res
      .status(ERROR_HTTP[code])
      .json({ error: { code, message, details, requestId: req.id ?? null } });
  }
}
