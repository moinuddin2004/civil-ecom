import {
  Injectable,
  Logger,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AppError } from '../../common/errors/app-error.js';
import { AuthCookies } from './auth-cookies.service.js';
import { AuthUserCache } from './auth-user-cache.service.js';
import {
  ALLOW_DURING_PASSWORD_CHANGE,
  AUTH_POLICY,
} from './auth.decorators.js';
import { emailNotVerifiedError } from './email-verification.error.js';
import type { AuthPolicy, Principal } from './auth.types.js';
import { assertAuthorized } from './authorization.js';
import { TokenService } from './token.service.js';

/**
 * The one authentication/authorization gate (registered globally, after the rate-limit and Origin
 * guards). **Secure by default**: an endpoint without a policy decorator is refused, so forgetting
 * one fails closed (SPEC §16: every admin route must declare its permission).
 *
 * For a protected route it verifies the access token with the audience's own key (a customer token
 * can't pass a staff route and vice versa), loads the user from the database (≤ 30 s cache) so
 * blocks and permission changes apply immediately, then checks the route's policy.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly cookies: AuthCookies,
    private readonly tokens: TokenService,
    private readonly users: AuthUserCache,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const targets = [context.getHandler(), context.getClass()];
    const policy = this.reflector.getAllAndOverride<AuthPolicy | undefined>(
      AUTH_POLICY,
      targets,
    );
    const request = context.switchToHttp().getRequest<Request>();

    if (!policy) {
      this.logger.error(
        `${request.method} ${request.path} has no auth policy decorator; refusing it.`,
      );
      throw AppError.forbidden();
    }
    if (policy.kind === 'public') return true;

    const audience = policy.kind === 'customer' ? 'customer' : 'admin';
    const token = this.cookies.readAccess(request, audience);
    if (!token) throw AppError.unauthenticated();

    const claims = await this.tokens.verifyAccess(token, audience);
    const user = await this.users.get(claims.sub);
    if (!user) throw AppError.unauthenticated();
    if (user.isDeleted) throw AppError.unauthenticated();
    if (user.status === 'blocked') {
      throw new AppError(
        'ACCOUNT_BLOCKED',
        'This account has been blocked. Contact us if you think this is a mistake.',
      );
    }

    // Signed out since this token was issued (logout, password change/reset, "sign out everywhere").
    // `iat` has second resolution, so compare in seconds.
    if (
      this.users.isFamilyRevoked(claims.fam) ||
      (user.tokensValidAfter !== null &&
        claims.iat < Math.floor(user.tokensValidAfter / 1000))
    ) {
      throw AppError.unauthenticated();
    }

    // Defence in depth: the audience key already separates them, the stored role must agree too.
    const roleFits =
      audience === 'customer'
        ? user.role === 'CUSTOMER'
        : user.role === 'ADMIN' || user.role === 'STAFF';
    if (!roleFits) throw AppError.unauthenticated();
    if (!user.emailVerified) throw emailNotVerifiedError(user.email);

    const principal: Principal = {
      ...user,
      userId: user.id,
      audience,
      familyId: claims.fam,
    };

    if (policy.kind === 'staff') {
      const allowedDuringChange = this.reflector.getAllAndOverride<
        boolean | undefined
      >(ALLOW_DURING_PASSWORD_CHANGE, targets);
      if (principal.mustChangePassword && !allowedDuringChange) {
        throw new AppError('FORBIDDEN', 'Set a new password to continue.', {
          reason: 'PASSWORD_CHANGE_REQUIRED',
        });
      }
      assertAuthorized(principal, policy);
    }

    request.principal = principal;
    return true;
  }
}
