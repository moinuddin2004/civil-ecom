import { AUTH_COOKIES } from '@aricon/shared';
import { Injectable } from '@nestjs/common';
import type { CookieOptions, Request, Response } from 'express';
import { AppConfig } from '../../config/app-config.service.js';
import type { Audience, ClientContext, IssuedTokens } from './auth.types.js';

/**
 * Auth cookies for the web app (CLAUDE.md §23): httpOnly (scripts can't read the tokens, so XSS
 * can't steal them), `Secure` in production, path `/` (the Next.js server forwards them on page
 * requests). The refresh cookie is `SameSite=Strict`: it is never needed on a navigation from
 * another site, only on our own refresh calls.
 */
@Injectable()
export class AuthCookies {
  constructor(private readonly config: AppConfig) {}

  private base(): CookieOptions {
    return { httpOnly: true, secure: this.config.isProduction, path: '/' };
  }

  set(res: Response, audience: Audience, tokens: IssuedTokens): void {
    const names = AUTH_COOKIES[audience];
    res.cookie(names.access, tokens.accessToken, { ...this.base(), sameSite: 'lax', expires: tokens.accessExpiresAt });
    res.cookie(names.refresh, tokens.refreshToken, {
      ...this.base(),
      sameSite: 'strict',
      expires: tokens.refreshExpiresAt,
    });
  }

  clear(res: Response, audience: Audience): void {
    const names = AUTH_COOKIES[audience];
    res.clearCookie(names.access, { ...this.base(), sameSite: 'lax' });
    res.clearCookie(names.refresh, { ...this.base(), sameSite: 'strict' });
  }

  /** The access token: the audience's cookie, or `Authorization: Bearer` for non-browser clients. */
  readAccess(req: Request, audience: Audience): string | null {
    const cookie = this.cookie(req, AUTH_COOKIES[audience].access);
    if (cookie) return cookie;
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) return header.slice('Bearer '.length).trim() || null;
    return null;
  }

  readRefresh(req: Request, audience: Audience): string | null {
    return this.cookie(req, AUTH_COOKIES[audience].refresh);
  }

  private cookie(req: Request, name: string): string | null {
    const value = (req.cookies as Record<string, unknown> | undefined)?.[name];
    return typeof value === 'string' && value ? value : null;
  }
}

export function clientContext(req: Request): ClientContext {
  const userAgent = req.headers['user-agent'];
  return { ip: req.ip, userAgent: typeof userAgent === 'string' ? userAgent : undefined };
}
