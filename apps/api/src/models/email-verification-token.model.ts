import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, type HydratedDocument, type Types } from 'mongoose';
import { BASE_SCHEMA_OPTIONS, type Lean, TimestampedEntity } from './common.js';

/**
 * `emailVerificationTokens`: one row per verification email, for customers and staff alike. Only the
 * SHA-256 of the emailed token is stored, so a database leak can't be used to verify addresses.
 * Tokens are single use and older open links stop working when a new one is requested.
 */
@Schema({ ...BASE_SCHEMA_OPTIONS, collection: 'emailVerificationTokens' })
export class EmailVerificationToken extends TimestampedEntity {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  /** Hex SHA-256 of the 32-byte random token sent by email. */
  @Prop({ type: String, required: true, match: /^[a-f\d]{64}$/ })
  tokenHash!: string;

  /** 60 minutes after creation by default; the TTL monitor deletes the row after this. */
  @Prop({ type: Date, required: true })
  expiresAt!: Date;

  /** Tokens are single use. */
  @Prop({ type: Date })
  usedAt?: Date;
}

export type EmailVerificationTokenDocument = HydratedDocument<EmailVerificationToken>;
export type EmailVerificationTokenLean = Lean<EmailVerificationToken>;

export const EmailVerificationTokenSchema = SchemaFactory.createForClass(EmailVerificationToken);

EmailVerificationTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
EmailVerificationTokenSchema.index({ tokenHash: 1 }, { unique: true });
EmailVerificationTokenSchema.index({ userId: 1, createdAt: -1 });
