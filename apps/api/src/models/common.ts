import { normalizePkPhone, SLUG_MAX, SLUG_PATTERN } from '@aricon/shared';
import type { Types } from 'mongoose';

/**
 * Building blocks shared by the Mongoose models (SPEC §5 "General rules"). Requests are validated
 * by the DTOs first; these validators are the last line of defence, so a bug in a service can never
 * store a float price, a negative count or a malformed phone number.
 */

/**
 * Base of every collection class (like a JPA `@MappedSuperclass`): `timestamps: true` adds these
 * two fields at runtime, and declaring them here (without `@Prop`) puts them in the TypeScript type,
 * so reads are typed correctly without casts.
 */
export abstract class TimestampedEntity {
  createdAt!: Date;
  updatedAt!: Date;
}

/** Shape of a document read with `.lean()`: the class fields plus `_id` (ObjectId unless the class declares its own). */
export type Lean<T> = T extends { _id: unknown } ? T : T & { _id: Types.ObjectId };

/** Options every collection starts from: timestamps on, unknown fields dropped. */
export const BASE_SCHEMA_OPTIONS = { timestamps: true, strict: true } as const;

function isWholeNumber(value: unknown): boolean {
  return value === null || value === undefined || Number.isInteger(value);
}

export const integerValidator = {
  validator: isWholeNumber,
  message: 'Use a whole number (no decimals).',
};

/** Stored phone numbers are already normalized to `+923XXXXXXXXX` by the DTOs. */
export const pkPhoneValidator = {
  validator: (value: unknown) =>
    value === null || value === undefined || (typeof value === 'string' && normalizePkPhone(value) === value),
  message: 'Store mobile numbers as +923XXXXXXXXX.',
};

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Loose shape check for stored emails (the DTOs do the real validation). */
export const emailValidator = {
  validator: (value: unknown) =>
    value === null || value === undefined || value === '' || (typeof value === 'string' && EMAIL_SHAPE.test(value)),
  message: 'Enter a valid email address, like name@example.com.',
};

/* Reusable `@Prop()` options (spread them: `@Prop({ ...MONEY, required: true })`). */

/** Money is an integer number of PKR, never negative (SPEC §5, CLAUDE.md §15). */
export const MONEY = {
  type: Number,
  min: [0, "Amounts can't be negative."] as [number, string],
  validate: { validator: isWholeNumber, message: 'Use whole rupees (no decimals).' },
};

/** Whole number ≥ 0 (counts, quantities, stock). */
export const COUNT = { type: Number, min: 0, validate: integerValidator };

/** Display order; any whole number. */
export const SORT_ORDER = { type: Number, required: true, default: 0, min: -100_000, max: 100_000, validate: integerValidator };

/** Lowercase `a-z0-9-` slug (the unique index is declared per schema, SPEC §5). */
export const SLUG = {
  type: String,
  required: true,
  trim: true,
  lowercase: true,
  maxlength: SLUG_MAX,
  match: [SLUG_PATTERN, 'Use lowercase letters, numbers and single dashes in the slug.'] as [RegExp, string],
};

/** Array length cap; the message is shown if a service ever tries to store more. */
export function maxItems(max: number, message: string) {
  return {
    validator: (value: unknown) => !Array.isArray(value) || value.length <= max,
    message,
  };
}
