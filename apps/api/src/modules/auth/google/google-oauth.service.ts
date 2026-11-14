import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import { AppConfig } from '../../../config/app-config.service.js';
import { AuthCookies, clientContext } from '../auth-cookies.service.js';
import { AuthUserCache } from '../auth-user-cache.service.js';
import { PasswordHasher, randomToken } from '../password-hasher.service.js';
import { TokenService } from '../token.service.js';
import type { UserLean } from '../../../models/user.model.js';
import { NotificationsService } from '../../notifications/notifications.service.js';
import { UsersRepository } from '../../users/users.repository.js';
import { GoogleIdTokenError, type GoogleIdentity } from './google-id-token.js';
import {
  GoogleIdentityService,
  GoogleSignInUnavailableError,
} from './google-identity.service.js';

/** Signed, httpOnly cookie holding state, PKCE verifier and nonce for one sign-in attempt. */
export const GOOGLE_OAUTH_COOKIE = 'aricon_google_oauth';
const STATE_TTL_SECONDS = 10 * 60;
const STATE_ISSUER = 'aricon-api';
const STATE_AUDIENCE = 'google-oauth';
const COOKIE_PATH = '/api/auth/google';

const FAILURE_MESSAGES: Record<string, string> = {
  google_cancelled: 'Google sign-in was cancelled.',
  google_failed: "Google sign-in didn't finish. Please try again.",
  google_unverified: "Google hasn't verified that email address. Verify it with Google, then try again.",
  google_staff: 'Staff accounts sign in with their email and password, not Google.',
  google_blocked: 'This account has been blocked. Contact us if you think this is a mistake.',
  google_account_mismatch:
    'This email is already linked to a different Google account. Sign in with that Google account, or use your password.',
  google_unavailable: 'Google sign-in is not set up on this server. Use email and password instead.',
};

interface StatePayload {
  state: string;
  verifier: string;
  nonce: string;
  next: string;
}

export type GoogleCallbackQuery = Record<string, unknown>;

class GoogleSignInError extends Error {
  constructor(readonly reason: keyof typeof FAILURE_MESSAGES) {
    super(reason);
  }
}

/**
 * Customer-only Google sign-in (authorization code + PKCE + state + nonce). Staff are deliberately
 * excluded: their email is checked before a session is made, and the account is never linked or
 * changed. New Google customers are created verified; an existing customer keeps their account.
 */
@Injectable()
export class GoogleOAuthService {
  private readonly logger = new Logger(GoogleOAuthService.name);

  constructor(
    private readonly config: AppConfig,
    private readonly jwt: JwtService,
    private readonly identity: GoogleIdentityService,
    private readonly users: UsersRepository,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenService,
    private readonly cookies: AuthCookies,
    private readonly cache: AuthUserCache,
    private readonly notifications: NotificationsService,
  ) {}

  /** Sends the browser to Google, remembering state/PKCE/nonce in a signed cookie. */
  async start(res: Response, nextRaw: unknown): Promise<void> {
    if (!this.identity.configured) {
      this.redirectToLogin(res, 'google_unavailable');
      return;
    }

    try {
      const state = randomToken();
      const verifier = randomToken();
      const nonce = randomToken();
      const next = safeNextPath(typeof nextRaw === 'string' ? nextRaw : null);
      const cookie = await this.jwt.signAsync(
        { state, verifier, nonce, next } satisfies StatePayload,
        {
          secret: this.stateSecret(),
          issuer: STATE_ISSUER,
          audience: STATE_AUDIENCE,
          algorithm: 'HS256',
          expiresIn: STATE_TTL_SECONDS,
        },
      );

      res.cookie(GOOGLE_OAUTH_COOKIE, cookie, this.cookieOptions(STATE_TTL_SECONDS * 1000));
      const challenge = createHash('sha256').update(verifier).digest('base64url');
      res.redirect(302, this.identity.authorizationUrl({ state, codeChallenge: challenge, nonce }));
    } catch (error) {
      this.logger.error({ err: error }, 'Google sign-in could not start');
      this.redirectToLogin(res, 'google_failed');
    }
  }

  /** Validates the callback, creates or links the customer, then starts the normal customer session. */
  async callback(req: Request, res: Response, query: GoogleCallbackQuery): Promise<void> {
    const payload = await this.readState(req);
    this.clearState(res);

    if (given(query.error)) {
      this.redirectToLogin(res, 'google_cancelled');
      return;
    }
    if (!payload || !this.identity.configured) {
      this.redirectToLogin(res, 'google_failed');
      return;
    }

    const code = given(query.code);
    const state = given(query.state);
    if (!code || !state || !safeEqual(state, payload.state)) {
      this.redirectToLogin(res, 'google_failed');
      return;
    }

    let identity: GoogleIdentity;
    try {
      identity = await this.identity.exchangeCode(code, payload.verifier, payload.nonce);
    } catch (error) {
      if (error instanceof GoogleIdTokenError && error.code === 'email_unverified') {
        this.redirectToLogin(res, 'google_unverified');
        return;
      }
      if (error instanceof GoogleSignInUnavailableError) {
        this.redirectToLogin(res, 'google_unavailable');
        return;
      }
      this.logger.warn({ code: error instanceof GoogleIdTokenError ? error.code : 'exchange' }, 'Google sign-in failed');
      this.redirectToLogin(res, 'google_failed');
      return;
    }

    if (identity.emailVerified !== true) {
      this.redirectToLogin(res, 'google_unverified');
      return;
    }

    let customer: UserLean;
    try {
      customer = await this.resolveCustomer(identity);
    } catch (error) {
      const reason = error instanceof GoogleSignInError ? error.reason : 'google_failed';
      if (!(error instanceof GoogleSignInError)) {
        this.logger.error({ err: error }, 'Google customer lookup failed');
      }
      this.redirectToLogin(res, reason);
      return;
    }

    try {
      const tokens = await this.tokens.startSession(
        String(customer._id),
        'customer',
        clientContext(req),
      );
      this.cookies.set(res, 'customer', tokens);
      res.redirect(302, this.successUrl(payload.next));
    } catch (error) {
      this.logger.error({ err: error }, 'Google sign-in session could not start');
      this.redirectToLogin(res, 'google_failed');
    }
  }

  private async resolveCustomer(identity: GoogleIdentity): Promise<UserLean> {
    const existing = await this.users.findActiveByEmail(identity.email);
    if (existing) return this.useExisting(existing, identity);

    const passwordHash = await this.hasher.hash(randomToken());
    try {
      const created = await this.users.create({
        name: displayName(identity),
        email: identity.email,
        passwordHash,
        role: 'CUSTOMER',
        emailVerified: true,
        googleSub: identity.subject,
      });
      await this.notifications.notify('user.welcome', {
        to: created.email,
        name: created.name,
        shopUrl: this.config.get('APP_URL'),
      });
      return created;
    } catch (error) {
      // Two first sign-ins at once: the unique email index picks one winner; use that account.
      const raced = await this.users.findActiveByEmail(identity.email);
      if (!raced) throw error;
      return this.useExisting(raced, identity);
    }
  }

  private async useExisting(user: UserLean, identity: GoogleIdentity): Promise<UserLean> {
    if (user.role !== 'CUSTOMER') throw new GoogleSignInError('google_staff');
    if (user.status !== 'active') throw new GoogleSignInError('google_blocked');
    if (user.googleSub && user.googleSub !== identity.subject) {
      throw new GoogleSignInError('google_account_mismatch');
    }

    if (user.emailVerified === false) {
      // Google proved ownership of the address, so the account now belongs to that person. The
      // password on an unverified account was chosen by whoever signed up, who may be someone else
      // (pre-account takeover): replace it with an unusable one and end every existing session.
      // The owner sets a password with "Forgot password".
      await this.users.setPassword(user._id, await this.hasher.hash(randomToken()));
      await this.users.markEmailVerified(user._id);
      await this.tokens.revokeAllForUser(String(user._id), 'password_changed');
      this.cache.invalidate(String(user._id));
    }
    if (!user.googleSub) await this.users.setGoogleSub(user._id, identity.subject);
    return user;
  }

  private async readState(req: Request): Promise<StatePayload | null> {
    const raw = (req.cookies as Record<string, unknown> | undefined)?.[GOOGLE_OAUTH_COOKIE];
    if (typeof raw !== 'string' || !raw) return null;
    try {
      const payload = await this.jwt.verifyAsync<StatePayload>(raw, {
        secret: this.stateSecret(),
        issuer: STATE_ISSUER,
        audience: STATE_AUDIENCE,
        algorithms: ['HS256'],
      });
      if (
        typeof payload.state !== 'string' ||
        typeof payload.verifier !== 'string' ||
        typeof payload.nonce !== 'string' ||
        typeof payload.next !== 'string'
      ) {
        return null;
      }
      return payload;
    } catch {
      return null;
    }
  }

  private stateSecret(): string {
    return this.config.get('JWT_CUSTOMER_SECRET');
  }

  private cookieOptions(maxAge: number) {
    return {
      httpOnly: true,
      secure: this.config.isProduction,
      sameSite: 'lax' as const,
      path: COOKIE_PATH,
      maxAge,
    };
  }

  private clearState(res: Response): void {
    res.clearCookie(GOOGLE_OAUTH_COOKIE, {
      httpOnly: true,
      secure: this.config.isProduction,
      sameSite: 'lax',
      path: COOKIE_PATH,
    });
  }

  private redirectToLogin(res: Response, reason: keyof typeof FAILURE_MESSAGES): void {
    if (!(reason in FAILURE_MESSAGES)) reason = 'google_failed';
    const url = new URL('/login', this.config.get('APP_URL'));
    url.searchParams.set('error', reason);
    res.redirect(302, url.toString());
  }

  private successUrl(next: string): string {
    return new URL(safeNextPath(next), this.config.get('APP_URL')).toString();
  }
}

/** Only same-site paths are valid after sign-in (never `//evil.com` or an absolute URL). */
export function safeNextPath(next: string | null | undefined, fallback = '/account'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) {
    return fallback;
  }
  return next;
}

function given(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}

function displayName(identity: GoogleIdentity): string {
  const fromGoogle = identity.name?.trim().slice(0, 80) ?? '';
  if (fromGoogle.length >= 2) return fromGoogle;
  const local = identity.email.split('@')[0]?.slice(0, 80) ?? '';
  return local.length >= 2 ? local : 'Customer';
}

function safeEqual(actual: string, expected: string): boolean {
  return timingSafeEqual(
    createHash('sha256').update(actual).digest(),
    createHash('sha256').update(expected).digest(),
  );
}
