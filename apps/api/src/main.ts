import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { loadEnv } from './config/env.js';
import { SeedService } from './seed.service.js';
import { configureApp } from './setup.js';

async function bootstrap() {
  const env = loadEnv();
  const app = await NestFactory.create(AppModule.forRoot(env), { bufferLogs: true });
  app.useLogger(app.get(Logger));
  configureApp(app, env.CORS_ORIGIN, env.TRUST_PROXY);
  if (env.STORE === 'memory') await app.get(SeedService).run(); // production data is seeded with `pnpm seed`
  app.enableShutdownHooks();
  await app.listen(env.PORT);
}

void bootstrap();
