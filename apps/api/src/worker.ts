import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { loadEnv, loadWorkspaceEnv } from './config/env.js';

/** Background-only process: same code, no HTTP port. `pnpm --filter @techfix/api worker`. */
async function bootstrap() {
  loadWorkspaceEnv();
  const env = { ...loadEnv(), RUN_WORKERS: true };
  const app = await NestFactory.createApplicationContext(AppModule.forRoot(env), {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
}

void bootstrap();
