import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, type HydratedDocument, type Types } from 'mongoose';
import { BASE_SCHEMA_OPTIONS, type Lean, TimestampedEntity } from './common.js';

/**
 * `passwordResets` (SPEC §5.3): one row per "forgot password" request. Only the SHA-256 of the
 * emailed token is stored, so a database leak can't be used to reset passwords.
 */
@Schema({ ...BASE_SCHEMA_OPTIONS, collection: 'passwordResets' })
export class PasswordReset extends TimestampedEntity {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  /** Hex SHA-256 of the 32-byte random token sent by email. */
  @Prop({ type: String, required: true, match: /^[a-f\d]{64}$/ })
  tokenHash!: string;

  /** 60 minutes after creation; the TTL monitor deletes the row after this. */
  @Prop({ type: Date, required: true })
  expiresAt!: Date;

  /** Tokens are single use. */
  @Prop({ type: Date })
  usedAt?: Date;
}

export type PasswordResetDocument = HydratedDocument<PasswordReset>;
export type PasswordResetLean = Lean<PasswordReset>;

export const PasswordResetSchema = SchemaFactory.createForClass(PasswordReset);

PasswordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
PasswordResetSchema.index({ tokenHash: 1 }, { unique: true });
PasswordResetSchema.index({ userId: 1 });
