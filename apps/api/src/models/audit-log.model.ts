import { AUDIT_ACTIONS, AUDIT_ENTITIES, ROLES, type AuditAction, type AuditEntity, type Role } from '@aricon/shared';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, type HydratedDocument, type Types } from 'mongoose';
import { BASE_SCHEMA_OPTIONS, type Lean, TimestampedEntity } from './common.js';

const USER_AGENT_MAX = 500;

/**
 * `auditLogs` (SPEC §5.16): who changed what, for every admin write listed in CLAUDE.md §31.
 * Append-only. `before`/`after` hold only the changed fields, never passwords or tokens.
 */
// Keep empty `before`/`after` objects: "created" entries legitimately have `before: {}`.
@Schema({ ...BASE_SCHEMA_OPTIONS, collection: 'auditLogs', minimize: false })
export class AuditLog extends TimestampedEntity {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  actorId!: Types.ObjectId;

  /** Snapshot of the actor's name at the time. */
  @Prop({ type: String, required: true, trim: true, maxlength: 80 })
  actorName!: string;

  @Prop({ type: String, enum: ROLES, required: true })
  actorRole!: Role;

  @Prop({ type: String, enum: AUDIT_ACTIONS, required: true })
  action!: AuditAction;

  @Prop({ type: String, enum: AUDIT_ENTITIES, required: true })
  entity!: AuditEntity;

  /** ObjectId hex string, or `'settings'` / `'home'` for the single-document collections. */
  @Prop({ type: String, required: true, maxlength: 60 })
  entityId!: string;

  @Prop({ type: MongooseSchema.Types.Mixed })
  before?: Record<string, unknown>;

  @Prop({ type: MongooseSchema.Types.Mixed })
  after?: Record<string, unknown>;

  @Prop({ type: String, maxlength: 64 })
  ip?: string;

  /** Truncated rather than rejected: an odd header must never make an audited write fail. */
  @Prop({ type: String, set: (value: unknown) => (typeof value === 'string' ? value.slice(0, USER_AGENT_MAX) : value) })
  userAgent?: string;

  @Prop({ type: Date, required: true, default: Date.now })
  at!: Date;
}

export type AuditLogDocument = HydratedDocument<AuditLog>;
export type AuditLogLean = Lean<AuditLog>;
export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

AuditLogSchema.index({ at: -1 });
AuditLogSchema.index({ entity: 1, entityId: 1, at: -1 });
AuditLogSchema.index({ actorId: 1, at: -1 });
