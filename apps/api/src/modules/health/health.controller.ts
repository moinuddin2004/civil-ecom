import { Controller, Get, Res } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { RawResponse } from '../../common/http/envelope.js';
import { Public } from '../auth/auth.decorators.js';
import { HealthService, type HealthStatus } from './health.service.js';

class HealthResponseDto implements HealthStatus {
  @ApiProperty({ enum: ['ok', 'error'] })
  status!: 'ok' | 'error';

  @ApiProperty({ enum: ['ok', 'down'] })
  db!: 'ok' | 'down';
}

/**
 * `GET /api/health` (SPEC §7.2): the literal body from the spec, not the `{ data }` envelope, and
 * 503 when the database doesn't answer — so the deploy health check fails and rolls back (§18.4).
 */
@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  @Public()
  @RawResponse()
  @SkipThrottle()
  @ApiOperation({ summary: 'Liveness and database connectivity' })
  @ApiResponse({ status: 200, type: HealthResponseDto })
  @ApiResponse({ status: 503, type: HealthResponseDto, description: 'The database is not reachable.' })
  async check(@Res({ passthrough: true }) res: Response): Promise<HealthStatus> {
    const result = await this.health.check();
    if (result.status !== 'ok') res.status(503);
    return result;
  }
}
