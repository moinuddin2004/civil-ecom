import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { type ClientSession, type Model, type Types } from 'mongoose';
import { BaseRepository } from '../../database/base.repository.js';
import { PasswordReset, type PasswordResetLean } from '../../models/password-reset.model.js';

const { trusted } = mongoose;

@Injectable()
export class PasswordResetRepository extends BaseRepository<PasswordReset, PasswordResetLean> {
  constructor(@InjectModel(PasswordReset.name) model: Model<PasswordReset>) {
    super(model);
  }

  async create(userId: Types.ObjectId, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.model.create({ userId, tokenHash, expiresAt });
  }

  /** Older unused links stop working when a new one is requested or a reset succeeds. */
  async invalidateOpen(userId: Types.ObjectId | string, now: Date, session?: ClientSession): Promise<void> {
    await this.model
      .updateMany({ userId, usedAt: trusted({ $exists: false }) }, { $set: { usedAt: now } }, { session })
      .exec();
  }

  /** Atomically uses a valid link (single use, not expired), or returns null. */
  async consume(tokenHash: string, now: Date, session?: ClientSession): Promise<PasswordResetLean | null> {
    return (await this.model
      .findOneAndUpdate(
        { tokenHash, usedAt: trusted({ $exists: false }), expiresAt: trusted({ $gt: now }) },
        { $set: { usedAt: now } },
        { session },
      )
      .lean()
      .exec()) as PasswordResetLean | null;
  }
}
