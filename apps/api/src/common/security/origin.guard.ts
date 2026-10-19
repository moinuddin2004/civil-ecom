import { Injectable, SetMetadata, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AppConfig } from '../../config/app-config.service.js';
import { AppError } from '../errors/app-error.js';

const SKIP_ORIGIN_CHECK = 'aricon:skip-origin-check';

/** Exempts an endpoint from the Origin check — only `POST /api/public/rfp` (SPEC §7.1), which has its own CORS allowlist. */
export const SkipOriginCheck = () => SetMetadata(SKIP_ORIGIN_CHECK, true);

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF protection for cookie-authenticated requests (SPEC §7.1, CLAUDE.md §28). Auth tokens travel
 * in httpOnly cookies for the web app, so a state-changing request must come from our own origin:
 *
 * - An `Origin` header that isn't ours → rejected.
 * - No `Origin` header but auth cookies → rejected (browsers always send `Origin` on cross-site
 *   POSTs; a cookie-carrying request without one isn't from our pages).
 * - No `Origin` and no cookies → allowed: a non-browser client (the future mobile app) using
 *   `Authorization: Bearer`, which a forged cross-site request can't attach.
 *
 * The Next.js server sets `Origin` on its own server-side calls (`apiServer()`).
 */
@Injectable()
export class OriginGuard implements CanActivate {
  private readonly trusted: Set<string>;

  constructor(
    private readonly reflector: Reflector,
    config: AppConfig,
  ) {
    this.trusted = new Set(config.trustedOrigins);
  }

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;
    const request = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(request.method)) return true;

    const skip = this.reflector.getAllAndOverride<boolean | undefined>(SKIP_ORIGIN_CHECK, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const origin = request.headers.origin;
    if (origin) {
      if (this.trusted.has(origin)) return true;
      throw AppError.forbidden("Requests from this site aren't allowed.");
    }

    const cookies = (request.cookies ?? {}) as Record<string, unknown>;
    if (Object.keys(cookies).length > 0) {
      throw AppError.forbidden("Requests from this site aren't allowed.");
    }
    return true;
  }
}
