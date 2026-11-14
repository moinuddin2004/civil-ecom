import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { type ClientSession, type Model, type Types } from 'mongoose';
import { BaseRepository } from '../../database/base.repository.js';
import {
  EmailVerificationToken,
  type EmailVerificationTokenLean,
} from '../../models/email-verification-token.model.js';

const { trusted } = mongoose;

@Injectable()
export class EmailVerificationRepository extends BaseRepository<
  EmailVerificationToken,
  EmailVerificationTokenLean
> {
  constructor(
    @InjectModel(EmailVerificationToken.name)
    model: Model<EmailVerificationToken>,
  ) {
    super(model);
  }

  async create(userId: Types.ObjectId, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.model.create({ userId, tokenHash, expiresAt });
  }

  /** Older unused links stop working when a new one is requested or the address is verified. */
  async invalidateOpen(
    userId: Types.ObjectId | string,
    now: Date,
    session?: ClientSession,
  ): Promise<void> {
    await this.model
      .updateMany(
        { userId, usedAt: trusted({ $exists: false }) },
        { $set: { usedAt: now } },
        { session },
      )
      .exec();
  }

  /** Atomically uses a valid link (single use, not expired), or returns null. */
  async consume(
    tokenHash: string,
    now: Date,
    session?: ClientSession,
  ): Promise<EmailVerificationTokenLean | null> {
    return (await this.model
      .findOneAndUpdate(
        { tokenHash, usedAt: trusted({ $exists: false }), expiresAt: trusted({ $gt: now }) },
        { $set: { usedAt: now } },
        { session },
      )
      .lean()
      .exec()) as EmailVerificationTokenLean | null;
  }

  /** The newest token for an account, used for the resend cooldown. */
  async latestCreatedAt(userId: Types.ObjectId | string): Promise<Date | null> {
    const row = await this.model
      .findOne({ userId })
      .sort({ createdAt: -1 })
      .select({ createdAt: 1 })
      .lean<{ createdAt: Date }>()
      .exec();
    return row?.createdAt ?? null;
  }
}
