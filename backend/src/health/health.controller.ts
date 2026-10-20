import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Pool } from 'pg';
import { Public } from '../common/decorators/public.decorator.js';
import { PG_POOL } from '../database/database.module.js';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /** GET /api/health — used by the frontend status badge and the host's health check. */
  @Public()
  @Get()
  async check() {
    try {
      await this.pool.query('SELECT 1');
      return { status: 'ok', database: 'up', time: new Date().toISOString() };
    } catch {
      throw new ServiceUnavailableException('Database is unreachable.');
    }
  }
}
