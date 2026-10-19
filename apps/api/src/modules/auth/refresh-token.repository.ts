import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { type Model, type Types } from 'mongoose';
import { BaseRepository } from '../../database/base.repository.js';
import {
  RefreshToken,
  type Audience,
  type RefreshTokenLean,
  type RevokeReason,
} from '../../models/refresh-token.model.js';

const { trusted } = mongoose;

export interface NewRefreshToken {
  userId: Types.ObjectId | string;
  audience: Audience;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
  userAgent?: string;
  ip?: string;
}

/*
 * Operators in filters are wrapped in `trusted()`: `sanitizeFilter` (database.module.ts) neuters
 * any `$` key it didn't get through `trusted()`, which is what blocks injection from request data.
 */

@Injectable()
export class RefreshTokenRepository extends BaseRepository<RefreshToken, RefreshTokenLean> {
  constructor(@InjectModel(RefreshToken.name) model: Model<RefreshToken>) {
    super(model);
  }

  async create(input: NewRefreshToken): Promise<void> {
    await this.model.create(input);
  }

  findByHash(tokenHash: string, audience: Audience): Promise<RefreshTokenLean | null> {
    return this.findOne({ tokenHash, audience });
  }

  /**
   * Atomically marks a live token as rotated and returns it (as it was before), or null when it is
   * unknown, expired, revoked or already rotated. Two parallel refreshes can't both win.
   */
  async claimForRotation(tokenHash: string, audience: Audience, now: Date): Promise<RefreshTokenLean | null> {
    return (await this.model
      .findOneAndUpdate(
        {
          tokenHash,
          audience,
          rotatedAt: trusted({ $exists: false }),
          revokedAt: trusted({ $exists: false }),
          expiresAt: trusted({ $gt: now }),
        },
        { $set: { rotatedAt: now } },
      )
      .lean()
      .exec()) as RefreshTokenLean | null;
  }

  async revokeFamily(familyId: string, reason: RevokeReason, now: Date): Promise<void> {
    await this.model
      .updateMany({ familyId, revokedAt: trusted({ $exists: false }) }, { $set: { revokedAt: now, revokedReason: reason } })
      .exec();
  }

  /** Signs a user out everywhere (or everywhere except one login). */
  async revokeAllForUser(
    userId: string,
    reason: RevokeReason,
    now: Date,
    options: { audience?: Audience; exceptFamilyId?: string } = {},
  ): Promise<void> {
    await this.model
      .updateMany(
        {
          userId,
          revokedAt: trusted({ $exists: false }),
          ...(options.audience ? { audience: options.audience } : {}),
          ...(options.exceptFamilyId ? { familyId: trusted({ $ne: options.exceptFamilyId }) } : {}),
        },
        { $set: { revokedAt: now, revokedReason: reason } },
      )
      .exec();
  }
}
