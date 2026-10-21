import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { EnvelopeInterceptor } from './common/envelope.interceptor.js';
import { ErrorFilter } from './common/error.filter.js';
import { requestId } from './common/request-id.middleware.js';

export const API_PREFIX = 'api/v1';

export function configureApp(app: INestApplication, corsOrigin: string, trustProxy = 0): void {
  if (trustProxy > 0)
    (app as NestExpressApplication).getHttpAdapter().getInstance().set('trust proxy', trustProxy);
  app.use(requestId);
  app.use(helmet());
  app.enableCors({ origin: corsOrigin.split(','), exposedHeaders: ['X-Request-Id'] });
  app.setGlobalPrefix(API_PREFIX);
  app.useGlobalInterceptors(new EnvelopeInterceptor());
  app.useGlobalFilters(new ErrorFilter());
}
