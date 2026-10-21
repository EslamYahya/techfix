import { Controller, Get, HttpException, Inject } from '@nestjs/common';
import { Public } from '../auth/auth.decorators.js';
import { DbService } from './db.service.js';

@Public()
@Controller('health')
export class HealthController {
  constructor(@Inject(DbService) private readonly db: DbService) {}

  @Get()
  live() {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready() {
    const r = await this.db.probe();
    if (!r.ok) throw new HttpException('Database unavailable', 503);
    return { status: 'ready', database: 'up', postgis: r.postgis };
  }
}
