import {
  DEFAULT_CITY,
  isPermission,
  MAX_ADDRESSES,
  ROLES,
  USER_STATUSES,
  type Permission,
  type Role,
  type UserStatus,
} from '@aricon/shared';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  Schema as MongooseSchema,
  type HydratedDocument,
  type Types,
} from 'mongoose';
import {
  BASE_SCHEMA_OPTIONS,
  emailValidator,
  integerValidator,
  maxItems,
  pkPhoneValidator,
  type Lean,
  TimestampedEntity,
} from './common.js';

/** Saved delivery address (customers only, SPEC §5.1). Has its own `_id` so the UI can edit one. */
@Schema({ strict: true })
export class Address {
  _id!: Types.ObjectId;

  /** e.g. "Site – Gulshan". */
  @Prop({ type: String, required: true, trim: true, maxlength: 60 })
  label!: string;

  @Prop({ type: String, required: true, trim: true, maxlength: 80 })
  contactName!: string;

  @Prop({ type: String, required: true, validate: pkPhoneValidator })
  phone!: string;

  @Prop({ type: String, required: true, trim: true, maxlength: 200 })
  line1!: string;

  @Prop({ type: String, trim: true, maxlength: 200 })
  line2?: string;

  @Prop({ type: String, trim: true, maxlength: 200 })
  landmark?: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'DeliveryArea',
    required: true,
  })
  areaId!: Types.ObjectId;

  @Prop({
    type: String,
    required: true,
    trim: true,
    maxlength: 60,
    default: DEFAULT_CITY,
  })
  city!: string;

  @Prop({ type: Boolean, required: true, default: false })
  isDefault!: boolean;
}

export const AddressSchema = SchemaFactory.createForClass(Address);

/** A saved address as plain data (lean reads and address-book changes), not a class instance. */
export type AddressData = { [K in keyof Address]: Address[K] };

/** "Exactly one default when addresses exist" (SPEC §5.1). */
const oneDefaultAddress = {
  validator: (addresses: unknown) => {
    if (!Array.isArray(addresses) || addresses.length === 0) return true;
    return (
      (addresses as { isDefault?: boolean }[]).filter(
        (address) => address.isDefault,
      ).length === 1
    );
  },
  message: 'Mark exactly one address as the default.',
};

/**
 * `users` (SPEC §5.1): customers, staff and admins in one collection, told apart by `role`.
 * `passwordHash` is `select: false` and stripped from JSON, so it only exists on a query that asks
 * for it with `.select('+passwordHash')` (login, password change).
 */
@Schema({
  ...BASE_SCHEMA_OPTIONS,
  collection: 'users',
  toJSON: { transform: omitPasswordHash },
  toObject: { transform: omitPasswordHash },
})
export class User extends TimestampedEntity {
  @Prop({
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 80,
  })
  name!: string;

  /** Lowercase; unique. */
  @Prop({
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    maxlength: 254,
    validate: emailValidator,
  })
  email!: string;

  /**
   * `+923XXXXXXXXX`, unique when present. Storefront sign-up requires it; optional for staff and for
   * customers created by Google sign-in (they can add one from their profile).
   */
  @Prop({ type: String, validate: pkPhoneValidator })
  phone?: string;

  /** bcrypt, cost 12. A Google-only account gets an unusable random hash until a password is set. */
  @Prop({ type: String, required: true, select: false })
  passwordHash!: string;

  /**
   * False until the person proves they own the email address. Login, refresh, and every protected
   * API refuse an unverified account. Existing accounts without this field are grandfathered by the
   * startup migration (`email-verification-migration.ts`).
   */
  @Prop({ type: Boolean, required: true, default: false })
  emailVerified!: boolean;

  /** When the address was verified (email link, Google, or the one-time legacy backfill). */
  @Prop({ type: Date })
  emailVerifiedAt?: Date;

  @Prop({ type: String, enum: ROLES, required: true, default: 'CUSTOMER' })
  role!: Role;

  /** Only meaningful for STAFF; stored with dependencies applied (`withDependencies`). */
  @Prop({
    type: [String],
    default: [],
    validate: {
      validator: (keys: unknown) =>
        Array.isArray(keys) && keys.every(isPermission),
      message: 'Use only permissions from the permission list.',
    },
  })
  permissions!: Permission[];

  @Prop({
    type: String,
    enum: USER_STATUSES,
    required: true,
    default: 'active',
  })
  status!: UserStatus;

  /** Soft delete; user and order history remain available for recovery and records. */
  @Prop({ type: Date })
  deletedAt?: Date;

  /** Customers (contractors). */
  @Prop({ type: String, trim: true, maxlength: 120 })
  companyName?: string;

  /** Customers only; at most 10, exactly one default when there are any. */
  @Prop({
    type: [AddressSchema],
    default: [],
    validate: [
      maxItems(MAX_ADDRESSES, `Save at most ${MAX_ADDRESSES} addresses.`),
      oneDefaultAddress,
    ],
  })
  addresses!: Address[];

  /** True for new staff and after an admin resets a password (SPEC §6.11). */
  @Prop({ type: Boolean, required: true, default: false })
  mustChangePassword!: boolean;

  @Prop({
    type: Number,
    required: true,
    default: 0,
    min: 0,
    validate: integerValidator,
  })
  failedLogins!: number;

  /** Set after 5 failed logins, for 15 minutes (SPEC §6.11). */
  @Prop({ type: Date })
  lockedUntil?: Date;

  @Prop({ type: Date })
  lastLoginAt?: Date;

  /**
   * Access tokens issued before this moment are refused (set on password change/reset and every
   * "sign out everywhere"), so a stolen access token dies with the refresh tokens.
   */
  @Prop({ type: Date })
  tokensValidAfter?: Date;

  /** Google account (`sub` claim) linked on first Google sign-in; a different `sub` is refused. */
  @Prop({ type: String })
  googleSub?: string;
}

function omitPasswordHash(
  _doc: unknown,
  ret: Record<string, unknown>,
): Record<string, unknown> {
  const { passwordHash: _passwordHash, ...rest } = ret;
  return rest;
}

export type UserDocument = HydratedDocument<User>;
/** A user as reads return it: `passwordHash` is `select: false`, so it is absent unless asked for. */
export type UserLean = Lean<Omit<User, 'passwordHash'>>;

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index(
  { email: 1 },
  {
    name: 'email_active_unique',
    unique: true,
    partialFilterExpression: { deletedAt: null },
  },
);
// Only active accounts reserve contact details; deleted records remain intact for order history.
UserSchema.index(
  { phone: 1 },
  {
    name: 'phone_active_unique',
    unique: true,
    partialFilterExpression: { phone: { $type: 'string' }, deletedAt: null },
  },
);
UserSchema.index(
  { googleSub: 1 },
  {
    name: 'google_sub_unique',
    unique: true,
    partialFilterExpression: { googleSub: { $type: 'string' } },
  },
);
UserSchema.index({ role: 1, status: 1 });
