import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { minutes, Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Public } from '../auth.decorators.js';
import { GoogleOAuthService, type GoogleCallbackQuery } from './google-oauth.service.js';

/**
 * Customer Google sign-in. Both endpoints are full browser navigations, so they redirect instead
 * of returning JSON: `start` goes to Google, `callback` sets the normal customer cookies.
 */
@ApiTags('Auth — customer')
@Controller('auth/google')
export class GoogleAuthController {
  constructor(private readonly google: GoogleOAuthService) {}

  @Get('start')
  @Public()
  @Throttle({ default: { limit: 20, ttl: minutes(15) } })
  @ApiOperation({ summary: 'Start Google sign-in (redirects to Google)' })
  start(@Query('next') next: unknown, @Res() res: Response): Promise<void> {
    return this.google.start(res, next);
  }

  @Get('callback')
  @Public()
  @Throttle({ default: { limit: 30, ttl: minutes(15) } })
  @ApiOperation({ summary: 'Google OAuth callback (redirects back to the shop)' })
  callback(
    @Req() req: Request,
    @Res() res: Response,
    @Query() query: GoogleCallbackQuery,
  ): Promise<void> {
    return this.google.callback(req, res, query);
  }
}
