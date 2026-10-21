import { Module, type DynamicModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { AuthController } from './auth/auth.controller.js';
import { AuthGuard } from './auth/auth.guard.js';
import { AuthService } from './auth/auth.service.js';
import { RateLimiter } from './auth/rate-limiter.js';
import { TokenService } from './auth/token.service.js';
import { CatalogController } from './catalog/catalog.controller.js';
import { CatalogService } from './catalog/catalog.service.js';
import { ENV, type Env } from './config/env.js';
import { CustomersController } from './customers/customers.controller.js';
import { CustomersService } from './customers/customers.service.js';
import { EngineersController } from './engineers/engineers.controller.js';
import { EngineersService } from './engineers/engineers.service.js';
import { DbService } from './health/db.service.js';
import { HealthController } from './health/health.controller.js';
import { createRepos } from './infra/repos.provider.js';
import { REPOS, type Repos } from './repos.js';
import { JobsController } from './jobs/jobs.controller.js';
import { JobsService } from './jobs/jobs.service.js';
import { IdempotencyService } from './common/idempotency.service.js';
import { FawryProvider } from './payments/fawry.provider.js';
import { PaymentsController } from './payments/payments.controller.js';
import { PaymentsService } from './payments/payments.service.js';
import { PAYMENT_PROVIDER, UnconfiguredProvider } from './payments/provider.js';
import { ReviewsController } from './reviews/reviews.controller.js';
import { ReviewsService } from './reviews/reviews.service.js';
import { QuotesController } from './quotes/quotes.controller.js';
import { QuotesService } from './quotes/quotes.service.js';
import { RequestsController } from './requests/requests.controller.js';
import { RequestsService } from './requests/requests.service.js';
import { AdminController } from './admin/admin.controller.js';
import { AdminService } from './admin/admin.service.js';
import { DomainEvents } from './events/domain-events.js';
import { NotificationsController } from './notifications/notifications.controller.js';
import { NotificationsService } from './notifications/notifications.service.js';
import { BullMqQueue } from './queue/bullmq.queue.js';
import { InlineQueue, JOB_QUEUE, type JobQueue } from './queue/queue.js';
import { WorkersService } from './workers/workers.service.js';
import { SeedService } from './seed.service.js';

@Module({})
export class AppModule {
  static forRoot(
    env: Env,
    repos?: Repos,
    fetchImpl?: typeof fetch,
    queue?: JobQueue,
  ): DynamicModule {
    return {
      module: AppModule,
      imports: [
        LoggerModule.forRoot({
          pinoHttp: {
            level: env.LOG_LEVEL,
            genReqId: (req) => (req as { id?: string }).id ?? '',
            redact: ['req.headers.authorization', 'req.headers.cookie'],
            transport: env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
          },
        }),
      ],
      controllers: [
        HealthController,
        AuthController,
        CatalogController,
        EngineersController,
        CustomersController,
        RequestsController,
        QuotesController,
        JobsController,
        PaymentsController,
        ReviewsController,
        NotificationsController,
        AdminController,
      ],
      providers: [
        { provide: ENV, useValue: env },
        { provide: REPOS, useFactory: async () => repos ?? createRepos(env) },
        { provide: APP_GUARD, useClass: AuthGuard },
        DbService,
        TokenService,
        RateLimiter,
        AuthService,
        CatalogService,
        EngineersService,
        CustomersService,
        RequestsService,
        QuotesService,
        JobsService,
        IdempotencyService,
        PaymentsService,
        ReviewsService,
        DomainEvents,
        AdminService,
        NotificationsService,
        WorkersService,
        {
          provide: JOB_QUEUE,
          useFactory: () =>
            queue ??
            (env.REDIS_URL && env.NODE_ENV !== 'test'
              ? new BullMqQueue(env.REDIS_URL, env.QUEUE_PREFIX)
              : new InlineQueue()),
        },
        {
          provide: PAYMENT_PROVIDER,
          useFactory: () =>
            env.FAWRY_MERCHANT_CODE && env.FAWRY_SECURITY_KEY && env.FAWRY_BASE_URL
              ? new FawryProvider({
                  merchantCode: env.FAWRY_MERCHANT_CODE,
                  secureKey: env.FAWRY_SECURITY_KEY,
                  baseUrl: env.FAWRY_BASE_URL.replace(/\/+$/, ''),
                  webhookUrl: env.FAWRY_WEBHOOK_URL,
                  fallbackEmail: env.FAWRY_FALLBACK_EMAIL,
                  ...(fetchImpl ? { fetchImpl } : {}),
                })
              : new UnconfiguredProvider(),
        },
        SeedService,
      ],
    };
  }
}
