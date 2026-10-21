import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { loadEnv } from '../config/env.js';
import { SeedService } from '../seed.service.js';

const env = loadEnv();
const app = await NestFactory.createApplicationContext(
  AppModule.forRoot({ ...env, RUN_WORKERS: false }),
  {
    logger: false,
  },
);
const result = await app.get(SeedService).run();
console.log(`catalog ready · admin: ${result.admin}`);
await app.close();
