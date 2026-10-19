import { JwtService } from '@nestjs/jwt';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppError } from '../../common/errors/app-error.js';
import type { AppConfig } from '../../config/app-config.service.js';
import type { Env } from '../../config/env.schema.js';
import type { Audience, RevokeReason } from '../../models/refresh-token.model.js';
import type { NewRefreshToken, RefreshTokenRepository } from './refresh-token.repository.js';
import { REUSE_GRACE_MS, TokenService } from './token.service.js';

interface Row {
  userId: string;
  audience: Audience;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
  rotatedAt?: Date;
  revokedAt?: Date;
  revokedReason?: RevokeReason;
}

/** In-memory stand-in for the refresh-token collection, with the same atomic semantics. */
class FakeRefreshTokens {
  rows: Row[] = [];

  async create(input: NewRefreshToken): Promise<void> {
    this.rows.push({ ...input, userId: String(input.userId) });
  }

  async findByHash(tokenHash: string, audience: Audience) {
    return this.rows.find((row) => row.tokenHash === tokenHash && row.audience === audience) ?? null;
  }

  async claimForRotation(tokenHash: string, audience: Audience, now: Date) {
    const row = this.rows.find(
      (candidate) =>
        candidate.tokenHash === tokenHash &&
        candidate.audience === audience &&
        !candidate.rotatedAt &&
        !candidate.revokedAt &&
        candidate.expiresAt > now,
    );
    if (!row) return null;
    const before = { ...row };
    row.rotatedAt = now;
    return before;
  }

  async revokeFamily(familyId: string, reason: RevokeReason, now: Date): Promise<void> {
    for (const row of this.rows) {
      if (row.familyId === familyId && !row.revokedAt) Object.assign(row, { revokedAt: now, revokedReason: reason });
    }
  }

  async revokeAllForUser(
    userId: string,
    reason: RevokeReason,
    now: Date,
    options: { audience?: Audience; exceptFamilyId?: string } = {},
  ): Promise<void> {
    for (const row of this.rows) {
      if (row.userId !== userId || row.revokedAt) continue;
      if (options.audience && row.audience !== options.audience) continue;
      if (options.exceptFamilyId && row.familyId === options.exceptFamilyId) continue;
      Object.assign(row, { revokedAt: now, revokedReason: reason });
    }
  }
}

const CONFIG: Partial<Env> = {
  JWT_CUSTOMER_SECRET: 'customer-secret-0123456789abcdef0123456789',
  JWT_ADMIN_SECRET: 'admin-secret-0123456789abcdef0123456789abc',
  JWT_ACCESS_TTL_SECONDS: 900,
  CUSTOMER_REFRESH_TTL_DAYS: 30,
  ADMIN_REFRESH_TTL_HOURS: 12,
};

const config = { get: (key: keyof Env) => CONFIG[key] } as unknown as AppConfig;
const USER = '665f1c2a9b1e8a0012a3b4c5';
const HOUR = 3_600_000;

async function unauthenticated(promise: Promise<unknown>): Promise<void> {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(AppError);
  expect((error as AppError).code).toBe('UNAUTHENTICATED');
}

describe('TokenService', () => {
  let repo: FakeRefreshTokens;
  let tokens: TokenService;

  beforeEach(() => {
    repo = new FakeRefreshTokens();
    tokens = new TokenService(new JwtService({}), config, repo as unknown as RefreshTokenRepository);
  });

  it('issues an access token that only its own audience accepts', async () => {
    const issued = await tokens.startSession(USER, 'customer', {});
    const claims = await tokens.verifyAccess(issued.accessToken, 'customer');
    expect(claims.sub).toBe(USER);
    expect(claims.fam).toBe(issued.familyId);
    // A customer token is useless on the admin API (different key and audience).
    await unauthenticated(tokens.verifyAccess(issued.accessToken, 'admin'));
  });

  it('stores only a hash of the refresh token', async () => {
    const issued = await tokens.startSession(USER, 'customer', {});
    expect(repo.rows).toHaveLength(1);
    expect(repo.rows[0]?.tokenHash).toMatch(/^[a-f\d]{64}$/);
    expect(repo.rows[0]?.tokenHash).not.toContain(issued.refreshToken);
  });

  it('rotates: the new token works and the family is kept', async () => {
    const first = await tokens.startSession(USER, 'customer', {});
    const { userId, tokens: second } = await tokens.rotate(first.refreshToken, 'customer', {});
    expect(userId).toBe(USER);
    expect(second.familyId).toBe(first.familyId);
    expect(second.refreshToken).not.toBe(first.refreshToken);
    await expect(tokens.rotate(second.refreshToken, 'customer', {})).resolves.toBeDefined();
  });

  it('gives customers a rolling window and staff a fixed one (SPEC §3.2)', async () => {
    const start = new Date('2026-10-01T10:00:00Z');
    const customer = await tokens.startSession(USER, 'customer', {}, start);
    const later = new Date(start.getTime() + 5 * HOUR);
    const rotatedCustomer = await tokens.rotate(customer.refreshToken, 'customer', {}, later);
    expect(rotatedCustomer.tokens.refreshExpiresAt.getTime()).toBe(later.getTime() + 30 * 24 * HOUR);

    const staff = await tokens.startSession(USER, 'admin', {}, start);
    const rotatedStaff = await tokens.rotate(staff.refreshToken, 'admin', {}, later);
    expect(rotatedStaff.tokens.refreshExpiresAt.getTime()).toBe(start.getTime() + 12 * HOUR);
  });

  it('treats a quick second use as a race: both get a working pair in the same family', async () => {
    const now = new Date();
    const first = await tokens.startSession(USER, 'customer', {}, now);
    const { tokens: second } = await tokens.rotate(first.refreshToken, 'customer', {}, now);
    const { tokens: parallel } = await tokens.rotate(first.refreshToken, 'customer', {}, new Date(now.getTime() + 1_000));
    expect(parallel.refreshToken).not.toBe(second.refreshToken);
    expect(repo.rows.every((row) => row.revokedAt === undefined)).toBe(true);
    await expect(tokens.rotate(second.refreshToken, 'customer', {}, now)).resolves.toBeDefined();
    await expect(tokens.rotate(parallel.refreshToken, 'customer', {}, now)).resolves.toBeDefined();
  });

  it('treats a late second use as theft: the whole family is revoked', async () => {
    const now = new Date();
    const first = await tokens.startSession(USER, 'customer', {}, now);
    const { tokens: second } = await tokens.rotate(first.refreshToken, 'customer', {}, now);
    const later = new Date(now.getTime() + REUSE_GRACE_MS + 1);
    await unauthenticated(tokens.rotate(first.refreshToken, 'customer', {}, later));
    expect(repo.rows.every((row) => row.revokedReason === 'reuse')).toBe(true);
    await unauthenticated(tokens.rotate(second.refreshToken, 'customer', {}, later));
  });

  it('refuses expired, unknown and wrong-audience refresh tokens', async () => {
    const start = new Date();
    const staff = await tokens.startSession(USER, 'admin', {}, start);
    await unauthenticated(tokens.rotate(staff.refreshToken, 'customer', {}, start));
    await unauthenticated(tokens.rotate('not-a-token', 'admin', {}, start));
    await unauthenticated(tokens.rotate(staff.refreshToken, 'admin', {}, new Date(start.getTime() + 13 * HOUR)));
  });

  it('signs a user out everywhere except the current login', async () => {
    const kept = await tokens.startSession(USER, 'admin', {});
    const other = await tokens.startSession(USER, 'admin', {});
    await tokens.revokeAllForUser(USER, 'password_changed', { exceptFamilyId: kept.familyId });
    await expect(tokens.rotate(kept.refreshToken, 'admin', {})).resolves.toBeDefined();
    await unauthenticated(tokens.rotate(other.refreshToken, 'admin', {}));
  });

  it('logs out by revoking the presented token’s family', async () => {
    const issued = await tokens.startSession(USER, 'customer', {});
    await tokens.revokeByToken(issued.refreshToken, 'customer', 'logout');
    await unauthenticated(tokens.rotate(issued.refreshToken, 'customer', {}));
  });
});
