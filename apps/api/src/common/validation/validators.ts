import { normalizePkPhone, PASSWORD_MAX, PASSWORD_MIN, QTY_MAX, QTY_MIN, SLUG_MAX, SLUG_PATTERN } from '@aricon/shared';
import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  registerDecorator,
  type ValidationOptions,
} from 'class-validator';

/*
 * Field rules shared by every DTO, built on the same constants and helpers as the web forms
 * (`@aricon/shared`), so a value the form accepts is one the API accepts — and the messages match.
 */

const trim = Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value));

/** Person's name: trimmed, 2–80 characters. */
export function IsPersonName() {
  return applyDecorators(
    trim,
    IsString({ message: 'Enter a name.' }),
    MinLength(2, { message: 'Enter at least 2 characters.' }),
    MaxLength(80, { message: 'Use at most 80 characters.' }),
  );
}

/** Email: trimmed and lowercased before validation, at most 254 characters. */
export function IsNormalizedEmail() {
  return applyDecorators(
    Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value)),
    IsString({ message: 'Enter your email address.' }),
    MaxLength(254, { message: 'Email is too long.' }),
    IsEmail({}, { message: 'Enter a valid email address, like name@example.com.' }),
  );
}

/** Password policy (SPEC §6.11): 8–72 characters with at least one letter and one number. */
export function IsStrongPassword() {
  return applyDecorators(
    IsString({ message: 'Enter a password.' }),
    Length(PASSWORD_MIN, PASSWORD_MAX, {
      message: `Use ${PASSWORD_MIN}–${PASSWORD_MAX} characters.`,
    }),
    Matches(/[A-Za-z]/, { message: 'Include at least one letter.' }),
    Matches(/\d/, { message: 'Include at least one number.' }),
  );
}

/** A URL slug (`cement-plaster`): lowercase letters, digits and single dashes (SPEC §5). */
export function IsSlug() {
  return applyDecorators(
    Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value)),
    IsString(),
    MaxLength(SLUG_MAX),
    Matches(SLUG_PATTERN, { message: 'Use lowercase letters, numbers and single dashes.' }),
  );
}

/** A MongoDB ObjectId as 24 hex characters (same rule as `objectIdSchema` in shared). */
export function IsObjectId(options: ValidationOptions = {}) {
  return applyDecorators(
    IsString({ ...options, message: 'Invalid id.' }),
    Matches(/^[a-f\d]{24}$/i, { ...options, message: 'Invalid id.' }),
  );
}

/** Integer PKR ≥ 0 (shared `moneySchema`, CLAUDE.md §15). Combine with `IsOptional()` for nullable fields. */
export function IsMoney() {
  return applyDecorators(
    IsInt({ message: 'Use whole rupees.' }),
    Min(0, { message: "Amount can't be negative." }),
    Max(1_000_000_000, { message: 'Amount is too large.' }),
  );
}

/** Optional calendar date `YYYY-MM-DD` (Karachi date filters; shared `dateQuery`). */
export function IsOptionalDateKey() {
  return applyDecorators(
    IsOptional(),
    Matches(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, { message: 'Use a date like 2026-09-26.' }),
  );
}

/** Display order (lower first). */
export function IsSortOrder() {
  return applyDecorators(IsInt({ message: 'Use a whole number.' }), Min(-100_000), Max(100_000));
}

/** A quantity: whole number within `min`–9,999 (SPEC §6.2). */
export function IsQty(min = QTY_MIN) {
  return applyDecorators(
    IsInt({ message: 'Use a whole number.' }),
    Min(min, { message: `Quantity must be at least ${min}.` }),
    Max(QTY_MAX, { message: `Quantity can be at most ${QTY_MAX.toLocaleString('en-US')}.` }),
  );
}

/** Optional query list `a,b,c` → `['a','b','c']` (empty parts dropped), at most `max` items. */
export function IsOptionalCsvList(max = 20, itemMaxLength = 120) {
  return applyDecorators(
    Transform(({ value }: { value: unknown }) => {
      if (typeof value !== 'string') return value;
      const items = value
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean);
      return items.length > 0 ? items : undefined;
    }),
    IsOptional(),
    IsArray(),
    ArrayMaxSize(max, { message: `Pick at most ${max} values.` }),
    IsString({ each: true }),
    MaxLength(itemMaxLength, { each: true }),
  );
}

/** Optional query boolean: `true`/`false`/`1`/`0`. */
export function IsOptionalQueryBoolean() {
  return applyDecorators(
    Transform(({ value }: { value: unknown }) => {
      if (value === 'true' || value === '1') return true;
      if (value === 'false' || value === '0') return false;
      return value;
    }),
    IsOptional(),
    IsBoolean({ message: 'Use true or false.' }),
  );
}

/** Required free text: trimmed, `min`–`max` characters (shared `requiredText`). */
export function IsRequiredText(min: number, max: number, label = 'This field') {
  return applyDecorators(
    trim,
    IsString({ message: `${label} is required.` }),
    MinLength(min, { message: min <= 1 ? `${label} is required.` : `Enter at least ${min} characters.` }),
    MaxLength(max, { message: `Use at most ${max} characters.` }),
  );
}

/**
 * Optional text that can be cleared (shared `clearableText`): missing = leave as is; `null` or an
 * empty string = clear (becomes `null`).
 */
export function IsClearableText(max: number) {
  return applyDecorators(
    Transform(({ value }: { value: unknown }) => {
      if (value === null) return null;
      if (typeof value !== 'string') return value;
      const trimmed = value.trim();
      return trimmed ? trimmed : null;
    }),
    IsOptional(),
    IsString(),
    MaxLength(max, { message: `Use at most ${max} characters.` }),
  );
}

/** Optional free text: trimmed; an empty string counts as "not given". */
export function IsOptionalText(max: number) {
  return applyDecorators(
    Transform(({ value }: { value: unknown }) => {
      if (typeof value !== 'string') return value;
      const trimmed = value.trim();
      return trimmed ? trimmed : undefined;
    }),
    IsOptional(),
    IsString(),
    MaxLength(max, { message: `Use at most ${max} characters.` }),
  );
}

function IsPkMobileNumber(options?: ValidationOptions): PropertyDecorator {
  return (target: object, propertyName: string | symbol) => {
    registerDecorator({
      name: 'isPkMobile',
      target: target.constructor,
      propertyName: String(propertyName),
      options: { message: 'Enter an 11-digit mobile number, like 0300 1234567.', ...options },
      validator: {
        // After the transform below, a valid number is already `+923XXXXXXXXX`.
        validate: (value: unknown) => typeof value === 'string' && normalizePkPhone(value) === value,
      },
    });
  };
}

/**
 * Pakistani mobile: accepts `03XX…`, `3XX…`, `+923XX…` (spaces/dashes allowed) and stores
 * `+923XXXXXXXXX` (CLAUDE.md §17 — one normalizer, from `@aricon/shared`).
 */
export function IsPkPhone() {
  return applyDecorators(
    Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? (normalizePkPhone(value) ?? value) : value)),
    IsPkMobileNumber(),
  );
}
