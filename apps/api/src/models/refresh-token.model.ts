import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, type HydratedDocument, type Types } from 'mongoose';
import { BASE_SCHEMA_OPTIONS, type Lean, TimestampedEntity } from './common.js';

/** Which app a token belongs to. Customer and staff tokens never mix (SPEC §3.2). */
export const AUDIENCES = ['customer', 'admin'] as const;
export type Audience = (typeof AUDIENCES)[number];

export const REVOKE_REASONS = ['logout', 'reuse', 'password_changed', 'blocked', 'role_changed'] as const;
export type RevokeReason = (typeof REVOKE_REASONS)[number];

/**
 * `refreshTokens`: one row per issued refresh token (the replacement for SPEC §5.2's session
 * collections). Only the SHA-256 of the token is stored, so a database leak can't be replayed.
 *
 * Every login starts a **family**; each refresh marks the presented token `rotatedAt` and issues a
 * new one in the same family. Presenting an already-rotated token means it was stolen (or replayed),
 * so the whole family is revoked. Revoking a user's families signs them out everywhere.
 */
@Schema({ ...BASE_SCHEMA_OPTIONS, collection: 'refreshTokens' })
export class RefreshToken extends TimestampedEntity {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ type: String, enum: AUDIENCES, required: true })
  audience!: Audience;

  /** Hex SHA-256 of the token sent in the cookie. */
  @Prop({ type: String, required: true, match: /^[a-f\d]{64}$/ })
  tokenHash!: string;

  /** Shared by every token descended from one login. */
  @Prop({ type: String, required: true })
  familyId!: string;

  /** MongoDB's TTL monitor deletes the row after this; services still compare it with "now". */
  @Prop({ type: Date, required: true })
  expiresAt!: Date;

  /** Set when this token was exchanged for a new one. */
  @Prop({ type: Date })
  rotatedAt?: Date;

  @Prop({ type: Date })
  revokedAt?: Date;

  @Prop({ type: String, enum: REVOKE_REASONS })
  revokedReason?: RevokeReason;

  /** For a future "signed-in devices" view and incident review; never used for decisions. */
  @Prop({ type: String, maxlength: 300 })
  userAgent?: string;

  @Prop({ type: String, maxlength: 64 })
  ip?: string;
}

export type RefreshTokenDocument = HydratedDocument<RefreshToken>;
export type RefreshTokenLean = Lean<RefreshToken>;

export const RefreshTokenSchema = SchemaFactory.createForClass(RefreshToken);

RefreshTokenSchema.index({ tokenHash: 1 }, { unique: true });
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
RefreshTokenSchema.index({ familyId: 1 });
RefreshTokenSchema.index({ userId: 1, audience: 1 });
