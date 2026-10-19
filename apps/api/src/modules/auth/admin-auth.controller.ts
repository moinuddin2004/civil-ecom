import type { AdminMeDTO } from '@aricon/shared';
import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { minutes, Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { ApiDataResponse, ApiErrorResponses } from '../../common/http/api-response.decorators.js';
import { AdminAuthService } from './admin-auth.service.js';
import { AuthCookies, clientContext } from './auth-cookies.service.js';
import { AllowDuringPasswordChange, CurrentUser, Public, StaffOnly } from './auth.decorators.js';
import type { Principal } from './auth.types.js';
import { AdminLoginDto, ChangePasswordDto } from './dto/auth.request.dto.js';
import { AdminMeResponseDto } from './dto/auth.response.dto.js';

/**
 * Staff/admin authentication (SPEC §7.3, §10.1). Separate cookies and signing key from customers.
 * While `mustChangePassword` is set, only these endpoints work (SPEC §6.11).
 */
@ApiTags('Auth — staff')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(
    private readonly auth: AdminAuthService,
    private readonly cookies: AuthCookies,
  ) {}

  @Post('login')
  @Public()
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: minutes(15) } })
  @ApiOperation({ summary: 'Staff sign-in' })
  @ApiDataResponse(AdminMeResponseDto)
  @ApiErrorResponses(400, 401, 403, 423, 429)
  async login(
    @Body() body: AdminLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AdminMeDTO> {
    const session = await this.auth.login(body, clientContext(req));
    this.cookies.set(res, 'admin', session.tokens);
    return session.me;
  }

  @Post('refresh')
  @Public()
  @HttpCode(200)
  @ApiOperation({ summary: 'Exchange the refresh cookie for new tokens (12 h absolute limit)' })
  @ApiDataResponse(AdminMeResponseDto)
  @ApiErrorResponses(401, 403)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<AdminMeDTO> {
    try {
      const session = await this.auth.refresh(this.cookies.readRefresh(req, 'admin'), clientContext(req));
      this.cookies.set(res, 'admin', session.tokens);
      return session.me;
    } catch (error) {
      this.cookies.clear(res, 'admin');
      throw error;
    }
  }

  @Post('logout')
  @Public()
  @HttpCode(204)
  @ApiOperation({ summary: 'Sign out this browser (always succeeds)' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logout(this.cookies.readRefresh(req, 'admin'));
    this.cookies.clear(res, 'admin');
  }

  @Get('me')
  @StaffOnly()
  @AllowDuringPasswordChange()
  @ApiOperation({ summary: 'The signed-in staff member with effective permissions' })
  @ApiDataResponse(AdminMeResponseDto)
  @ApiErrorResponses(401, 403)
  me(@CurrentUser() user: Principal): Promise<AdminMeDTO> {
    return this.auth.me(user.userId);
  }

  @Post('change-password')
  @StaffOnly()
  @AllowDuringPasswordChange()
  @HttpCode(200)
  @ApiOperation({ summary: 'Change own password; clears a forced change and signs out other logins' })
  @ApiDataResponse(AdminMeResponseDto)
  @ApiErrorResponses(400, 401, 403)
  changePassword(@CurrentUser() user: Principal, @Body() body: ChangePasswordDto): Promise<AdminMeDTO> {
    return this.auth.changePassword(user, body);
  }
}
