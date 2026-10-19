import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { hours, Throttle } from '@nestjs/throttler';
import { ApiErrorResponses } from '../../common/http/api-response.decorators.js';
import { SkipOriginCheck } from '../../common/security/origin.guard.js';
import { Public } from '../auth/auth.decorators.js';
import { RfpDto } from './rfp.dto.js';
import { RfpService } from './rfp.service.js';

/**
 * The inquiry form on the company website (SPEC §7.2). It posts from another origin, so the Origin
 * check is skipped here and CORS allows only `RFP_CORS_ORIGINS` (see `configureApp`); it uses no
 * cookies, so there is nothing for another site to ride on.
 */
@ApiTags('Public')
@Public()
@SkipOriginCheck()
@Controller('public')
export class RfpController {
  constructor(private readonly rfp: RfpService) {}

  @Post('rfp')
  @HttpCode(204)
  @Throttle({ default: { limit: 5, ttl: hours(1) } })
  @ApiOperation({ summary: 'Send a company-website inquiry (emailed to Aricon, not stored)' })
  @ApiNoContentResponse()
  @ApiErrorResponses(400, 429)
  async submit(@Body() body: RfpDto): Promise<void> {
    await this.rfp.submit(body);
  }
}
