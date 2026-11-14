import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module.js';
import { AdminAuthController } from './admin-auth.controller.js';
import { AdminAuthService } from './admin-auth.service.js';
import { AuthCookies } from './auth-cookies.service.js';
import { AuthUserCache } from './auth-user-cache.service.js';
import { AuthGuard } from './auth.guard.js';
import { CredentialsService } from './credentials.service.js';
import { CustomerAuthController } from './customer-auth.controller.js';
import { CustomerAuthService } from './customer-auth.service.js';
import { EmailVerificationRepository } from './email-verification.repository.js';
import { EmailVerificationService } from './email-verification.service.js';
import { GoogleAuthController } from './google/google-auth.controller.js';
import { GoogleIdentityService } from './google/google-identity.service.js';
import { GoogleOAuthService } from './google/google-oauth.service.js';
import { PasswordHasher } from './password-hasher.service.js';
import { PasswordResetRepository } from './password-reset.repository.js';
import { PasswordResetService } from './password-reset.service.js';
import { RefreshTokenRepository } from './refresh-token.repository.js';
import { TokenService } from './token.service.js';

/**
 * Authentication and authorization. Registers the global `AuthGuard` (after CommonModule's
 * rate-limit and Origin guards) and exports what other modules need to act on a user's sessions:
 * block a user → `TokenService.revokeAllForUser` + `AuthUserCache.invalidate`; check a current
 * password → `CredentialsService.verifyCurrentPassword`.
 */
@Module({
  imports: [
    UsersModule,
    // No default secret: TokenService passes the audience's own key on every sign/verify.
    JwtModule.register({}),
  ],
  controllers: [CustomerAuthController, AdminAuthController, GoogleAuthController],
  providers: [
    PasswordHasher,
    AuthUserCache,
    AuthCookies,
    RefreshTokenRepository,
    PasswordResetRepository,
    EmailVerificationRepository,
    TokenService,
    CredentialsService,
    CustomerAuthService,
    AdminAuthService,
    PasswordResetService,
    EmailVerificationService,
    GoogleIdentityService,
    GoogleOAuthService,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [
    PasswordHasher,
    TokenService,
    AuthUserCache,
    CredentialsService,
    EmailVerificationService,
    GoogleIdentityService,
  ],
})
export class AuthModule {}
