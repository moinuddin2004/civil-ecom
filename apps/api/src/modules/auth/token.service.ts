import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { AppError } from '../../common/errors/app-error.js';
import { AppConfig } from '../../config/app-config.service.js';
import type { RevokeReason } from '../../models/refresh-token.model.js';
import type { AccessClaims, Audience, ClientContext, IssuedTokens } from './auth.types.js';
import { UsersRepository } from '../users/users.repository.js';
import { AuthUserCache } from './auth-user-cache.service.js';
import { hashToken, randomToken } from './password-hasher.service.js';
import { RefreshTokenRepository } from './refresh-token.repository.js';

const ISSUER = 'aricon-api';
const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

/**
 * Parallel requests (a page and its prefetches, two tabs) can refresh at the same moment with the
 * same token. Re-presenting a token rotated this recently is treated as that race: it gets a fresh
 * pair in the same family, so whichever response the browser keeps, the login survives. After the
 * grace period it is treated as theft and the whole family is revoked.
 */
export const REUSE_GRACE_MS = 10_000;

const SESSION_EXPIRED = 'Your session has expired. Please log in again.';

/**
 * Access tokens (short-lived JWT, HS256, a separate key per audience) and refresh tokens (opaque,
 * stored hashed, rotated on every use with reuse detection). See PROGRESS.md "Backend decisions".
 */
@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: AppConfig,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly users: UsersRepository,
    private readonly cache: AuthUserCache,
  ) {}

  private secretFor(audience: Audience): string {
    return audience === 'admin' ? this.config.get('JWT_ADMIN_SECRET') : this.config.get('JWT_CUSTOMER_SECRET');
  }

  async verifyAccess(token: string, audience: Audience): Promise<AccessClaims> {
    try {
      const claims = await this.jwt.verifyAsync<AccessClaims>(token, {
        secret: this.secretFor(audience),
        audience,
        issuer: ISSUER,
        algorithms: ['HS256'],
      });
      if (typeof claims.sub !== 'string' || typeof claims.fam !== 'string' || typeof claims.iat !== 'number') {
        throw new Error('malformed claims');
      }
      return claims;
    } catch {
      throw AppError.unauthenticated(SESSION_EXPIRED);
    }
  }

  /** A new login: a new refresh-token family. */
  startSession(userId: string, audience: Audience, client: ClientContext, now = new Date()): Promise<IssuedTokens> {
    const refreshExpiresAt =
      audience === 'admin'
        ? new Date(now.getTime() + this.config.get('ADMIN_REFRESH_TTL_HOURS') * HOUR_MS)
        : new Date(now.getTime() + this.config.get('CUSTOMER_REFRESH_TTL_DAYS') * DAY_MS);
    return this.issue(userId, audience, randomUUID(), refreshExpiresAt, client, now);
  }

  /**
   * Exchanges a refresh token for a new pair. Customers get a rolling 30-day window; staff keep the
   * family's original expiry (12 hours absolute, SPEC §3.2). Returns the user id the token belongs
   * to; the caller checks that user is still allowed in.
   */
  async rotate(
    refreshToken: string,
    audience: Audience,
    client: ClientContext,
    now = new Date(),
  ): Promise<{ userId: string; tokens: IssuedTokens }> {
    const tokenHash = hashToken(refreshToken);
    const claimed = await this.refreshTokens.claimForRotation(tokenHash, audience, now);

    let source = claimed;
    if (!source) {
      const existing = await this.refreshTokens.findByHash(tokenHash, audience);
      // A rotated (not yet revoked, not expired) token presented again: a race inside the grace
      // period, theft after it.
      const rotatedAt = existing && !existing.revokedAt && existing.expiresAt > now ? existing.rotatedAt : undefined;
      if (!existing || !rotatedAt) throw AppError.unauthenticated(SESSION_EXPIRED);
      if (now.getTime() - rotatedAt.getTime() > REUSE_GRACE_MS) {
        await this.refreshTokens.revokeFamily(existing.familyId, 'reuse', now);
        this.cache.revokeFamilyAccess(existing.familyId);
        this.logger.warn({ userId: String(existing.userId), audience }, 'Refresh token reuse detected; family revoked');
        throw AppError.unauthenticated(SESSION_EXPIRED);
      }
      source = existing;
    }

    const refreshExpiresAt =
      audience === 'admin'
        ? source.expiresAt
        : new Date(now.getTime() + this.config.get('CUSTOMER_REFRESH_TTL_DAYS') * DAY_MS);
    const userId = String(source.userId);
    const tokens = await this.issue(userId, audience, source.familyId, refreshExpiresAt, client, now);
    return { userId, tokens };
  }

  /** Logout: the presented token's whole family. Unknown tokens are ignored (logout always succeeds). */
  async revokeByToken(refreshToken: string, audience: Audience, reason: RevokeReason, now = new Date()): Promise<void> {
    const existing = await this.refreshTokens.findByHash(hashToken(refreshToken), audience);
    if (!existing) return;
    await this.refreshTokens.revokeFamily(existing.familyId, reason, now);
    // The family's access token must stop working too, not only its refresh token.
    this.cache.revokeFamilyAccess(existing.familyId);
  }

  /**
   * Signs a user out everywhere, optionally keeping one login (e.g. the one changing the password):
   * revokes the refresh tokens and refuses every access token issued before now (the kept login's
   * access token included; its next refresh gets a fresh one).
   */
  async revokeAllForUser(
    userId: string,
    reason: RevokeReason,
    options: { audience?: Audience; exceptFamilyId?: string } = {},
    now = new Date(),
  ): Promise<void> {
    await this.refreshTokens.revokeAllForUser(userId, reason, now, options);
    await this.users.setTokensValidAfter(userId, now);
    this.cache.invalidate(userId);
  }

  private async issue(
    userId: string,
    audience: Audience,
    familyId: string,
    refreshExpiresAt: Date,
    client: ClientContext,
    now: Date,
  ): Promise<IssuedTokens> {
    const ttlSeconds = this.config.get('JWT_ACCESS_TTL_SECONDS');
    const claims: Omit<AccessClaims, 'iat'> = { sub: userId, aud: audience, fam: familyId };
    const accessToken = await this.jwt.signAsync(
      { fam: claims.fam },
      {
        secret: this.secretFor(audience),
        subject: claims.sub,
        audience,
        issuer: ISSUER,
        algorithm: 'HS256',
        expiresIn: ttlSeconds,
      },
    );

    const refreshToken = randomToken();
    await this.refreshTokens.create({
      userId,
      audience,
      tokenHash: hashToken(refreshToken),
      familyId,
      expiresAt: refreshExpiresAt,
      userAgent: client.userAgent?.slice(0, 300),
      ip: client.ip?.slice(0, 64),
    });

    return {
      accessToken,
      accessExpiresAt: new Date(now.getTime() + ttlSeconds * 1000),
      refreshToken,
      refreshExpiresAt,
      familyId,
    };
  }
}
