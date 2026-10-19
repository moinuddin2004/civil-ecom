import type { CustomerDTO } from '@aricon/shared';
import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { hours, minutes, Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { ApiDataResponse, ApiErrorResponses } from '../../common/http/api-response.decorators.js';
import { AuthCookies, clientContext } from './auth-cookies.service.js';
import { CurrentUser, CustomerOnly, Public } from './auth.decorators.js';
import type { Principal } from './auth.types.js';
import { CustomerAuthService } from './customer-auth.service.js';
import { ForgotPasswordDto, LoginDto, ResetPasswordDto, SignupDto } from './dto/auth.request.dto.js';
import { CustomerResponseDto } from './dto/auth.response.dto.js';
import { PasswordResetService } from './password-reset.service.js';

export const FORGOT_PASSWORD_MESSAGE =
  "If an account exists for that email, we've sent a link to reset your password. It works for 60 minutes.";

class MessageResponseDto {
  @ApiProperty({ example: FORGOT_PASSWORD_MESSAGE })
  message!: string;
}

/**
 * Customer authentication (SPEC §7.2). Tokens are set as httpOnly cookies; the body carries the
 * customer. Rate limits per SPEC §7.1 (per IP; the account lockout covers per-identifier abuse).
 */
@ApiTags('Auth — customer')
@Controller('auth')
export class CustomerAuthController {
  constructor(
    private readonly auth: CustomerAuthService,
    private readonly resets: PasswordResetService,
    private readonly cookies: AuthCookies,
  ) {}

  @Post('signup')
  @Public()
  @Throttle({ default: { limit: 5, ttl: hours(1) } })
  @ApiOperation({ summary: 'Create a customer account and sign in' })
  @ApiDataResponse(CustomerResponseDto, { status: 201 })
  @ApiErrorResponses(400, 409, 429)
  async signup(
    @Body() body: SignupDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<CustomerDTO> {
    const session = await this.auth.signup(body, clientContext(req));
    this.cookies.set(res, 'customer', session.tokens);
    return session.customer;
  }

  @Post('login')
  @Public()
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: minutes(15) } })
  @ApiOperation({ summary: 'Sign in with email or mobile number' })
  @ApiDataResponse(CustomerResponseDto)
  @ApiErrorResponses(400, 401, 403, 423, 429)
  async login(
    @Body() body: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<CustomerDTO> {
    const session = await this.auth.login(body, clientContext(req));
    this.cookies.set(res, 'customer', session.tokens);
    return session.customer;
  }

  @Post('refresh')
  @Public()
  @HttpCode(200)
  @ApiOperation({ summary: 'Exchange the refresh cookie for new tokens (rotates the refresh token)' })
  @ApiDataResponse(CustomerResponseDto)
  @ApiErrorResponses(401, 403)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<CustomerDTO> {
    try {
      const session = await this.auth.refresh(this.cookies.readRefresh(req, 'customer'), clientContext(req));
      this.cookies.set(res, 'customer', session.tokens);
      return session.customer;
    } catch (error) {
      // A dead refresh token is useless; make the browser forget it.
      this.cookies.clear(res, 'customer');
      throw error;
    }
  }

  @Post('logout')
  @Public()
  @HttpCode(204)
  @ApiOperation({ summary: 'Sign out this browser (always succeeds)' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logout(this.cookies.readRefresh(req, 'customer'));
    this.cookies.clear(res, 'customer');
  }

  @Get('me')
  @CustomerOnly()
  @ApiOperation({ summary: 'The signed-in customer' })
  @ApiDataResponse(CustomerResponseDto)
  @ApiErrorResponses(401, 403)
  me(@CurrentUser() user: Principal): Promise<CustomerDTO> {
    return this.auth.me(user.userId);
  }

  @Post('forgot-password')
  @Public()
  @HttpCode(200)
  @Throttle({ default: { limit: 3, ttl: hours(1) } })
  @ApiOperation({ summary: 'Email a reset link (the answer is the same whether or not the email exists)' })
  @ApiDataResponse(MessageResponseDto)
  @ApiErrorResponses(400, 429)
  async forgotPassword(@Body() body: ForgotPasswordDto): Promise<MessageResponseDto> {
    await this.resets.requestReset(body.email);
    return { message: FORGOT_PASSWORD_MESSAGE };
  }

  @Post('reset-password')
  @Public()
  @HttpCode(204)
  @Throttle({ default: { limit: 10, ttl: hours(1) } })
  @ApiOperation({ summary: 'Set a new password with a reset link; signs out everywhere' })
  @ApiErrorResponses(400, 429)
  async resetPassword(@Body() body: ResetPasswordDto): Promise<void> {
    await this.resets.resetPassword(body.token, body.password);
  }
}
