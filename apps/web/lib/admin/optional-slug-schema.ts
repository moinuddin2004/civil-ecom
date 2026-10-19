import { SLUG_MAX, SLUG_PATTERN } from '@aricon/shared';
import { z } from 'zod';

/**
 * An editable "auto from name" slug field for admin forms. The shared `slugSchema` (SPEC §5
 * "Slugs") is `z.string()...regex(...).optional()`, but `.optional()` only allows the field to be
 * *absent* — an empty string still has to satisfy the full pattern, so leaving the field blank in a
 * plain HTML form (which submits `""`, not `undefined`) would incorrectly fail validation. This
 * treats a blank value as "not given" (the admin-data layer/slugify falls back to the name) and
 * only checks the pattern once something has actually been typed.
 */
export const optionalSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(SLUG_MAX, `Use at most ${SLUG_MAX} characters.`)
  .optional()
  .transform((value) => (value ? value : undefined))
  .refine((value) => value === undefined || SLUG_PATTERN.test(value), 'Use lowercase letters, numbers and single dashes.');
