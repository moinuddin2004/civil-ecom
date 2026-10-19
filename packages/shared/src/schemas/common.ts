import { z } from 'zod';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../api.js';
import { PASSWORD_MAX, PASSWORD_MIN, QTY_MAX, QTY_MIN } from '../constants.js';
import { normalizePkPhone } from '../phone.js';
import { SLUG_MAX, SLUG_PATTERN } from '../text.js';

/** Building blocks for request schemas. Messages are shown to people, so they say how to fix it. */

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id.');

/** Integer PKR ≥ 0. */
export const moneySchema = z
  .number({ error: 'Enter an amount in rupees.' })
  .int('Use whole rupees.')
  .min(0, "Amount can't be negative.")
  .max(1_000_000_000, 'Amount is too large.');

export const qtySchema = z
  .number({ error: 'Enter a quantity.' })
  .int('Use a whole number.')
  .min(QTY_MIN, `Quantity must be at least ${QTY_MIN}.`)
  .max(QTY_MAX, `Quantity can be at most ${QTY_MAX.toLocaleString('en-US')}.`);

export const nameSchema = z
  .string()
  .trim()
  .min(2, 'Enter at least 2 characters.')
  .max(80, 'Use at most 80 characters.');

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, 'Email is too long.')
  .pipe(z.email('Enter a valid email address, like name@example.com.'));

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters.`)
  .max(PASSWORD_MAX, `Use at most ${PASSWORD_MAX} characters.`)
  .regex(/[A-Za-z]/, 'Include at least one letter.')
  .regex(/\d/, 'Include at least one number.');

/** Accepts 03XX…, 3XX…, +923XX… and returns +923XXXXXXXXX. */
export const pkPhoneSchema = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const phone = normalizePkPhone(value);
    if (!phone) {
      ctx.addIssue({ code: 'custom', message: 'Enter an 11-digit mobile number, like 0300 1234567.' });
      return z.NEVER;
    }
    return phone;
  });

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(SLUG_MAX, `Use at most ${SLUG_MAX} characters.`)
  .regex(SLUG_PATTERN, 'Use lowercase letters, numbers and single dashes.');

/** Optional free text: trimmed, and an empty string counts as "not given". */
export function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max, `Use at most ${max} characters.`)
    .optional()
    .transform((value) => (value ? value : undefined));
}

/** Like `optionalText` but `null` (or an empty string) clears the stored value on update. */
export function clearableText(max: number) {
  return z
    .string()
    .trim()
    .max(max, `Use at most ${max} characters.`)
    .nullable()
    .transform((value) => (value ? value : null));
}

export function requiredText(min: number, max: number, label = 'This field') {
  return z
    .string()
    .trim()
    .min(min, min <= 1 ? `${label} is required.` : `Enter at least ${min} characters.`)
    .max(max, `Use at most ${max} characters.`);
}

/* Query-string helpers: values arrive as strings. */

export const pageQuery = {
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
};

/** `"a,b,c"` → `["a","b","c"]` (empty parts dropped), at most `max` items. */
export function csvQuery(max = 20) {
  return z
    .string()
    .max(2_000)
    .transform((value) =>
      value
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.string().max(120)).max(max));
}

export const booleanQuery = z
  .enum(['true', 'false', '1', '0'])
  .transform((value) => value === 'true' || value === '1');

export const intQuery = z.coerce.number().int().min(0).max(1_000_000_000);

/** `YYYY-MM-DD` (interpreted as a Karachi calendar date by the API). */
export const dateQuery = z.iso.date('Use a date like 2026-09-26.');

/** `?sort=field:dir` limited to `fields`. */
export function sortQuery<const F extends readonly [string, ...string[]]>(fields: F) {
  const field = z.enum(fields);
  return z
    .string()
    .transform((value, ctx) => {
      const [name, direction = 'asc'] = value.split(':');
      const parsed = field.safeParse(name);
      if (!parsed.success || (direction !== 'asc' && direction !== 'desc')) {
        ctx.addIssue({ code: 'custom', message: `Sort by one of: ${fields.join(', ')} (asc or desc).` });
        return z.NEVER;
      }
      return { field: parsed.data, direction: direction as 'asc' | 'desc' };
    });
}

export const idParams = z.strictObject({ id: objectIdSchema });
