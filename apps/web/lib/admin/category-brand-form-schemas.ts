import { CATALOG_STATUSES, optionalText, requiredText } from '@aricon/shared';
import { z } from 'zod';
import { optionalSlugSchema } from './optional-slug-schema';

/**
 * Form variants of `categoryCreateSchema` / `brandCreateSchema`
 * (`packages/shared/src/schemas/catalog.ts`, SPEC §5.4–5.5) for the add/edit dialogs: a blank slug
 * means "not given" (`optionalSlugSchema`), the parent select's empty "None (top level)" option
 * becomes `null`. `imageKey`/`logoKey` come from the uploader (null = no picture) and `id` is the
 * id a new record's picture was uploaded under (sent on create so the key belongs to it).
 * Every other field/validator is reused as-is (CLAUDE.md 2.5).
 */

const sortOrder = z.number().int().min(-100_000).max(100_000);

export const categoryFormSchema = z.strictObject({
  name: requiredText(2, 80, 'Name'),
  slug: optionalSlugSchema,
  /** null = top level. */
  parentId: z
    .string()
    .nullish()
    .transform((value) => value || null),
  description: optionalText(2_000),
  sortOrder: sortOrder.default(0),
  showOnHome: z.boolean().default(false),
  status: z.enum(CATALOG_STATUSES).default('active'),
  imageKey: z.string().nullable().default(null),
  id: z.string().optional(),
});
export type CategoryFormInput = z.input<typeof categoryFormSchema>;
export type CategoryFormValues = z.output<typeof categoryFormSchema>;

export const brandFormSchema = z.strictObject({
  name: requiredText(2, 80, 'Name'),
  slug: optionalSlugSchema,
  sortOrder: sortOrder.default(0),
  status: z.enum(CATALOG_STATUSES).default('active'),
  logoKey: z.string().nullable().default(null),
  id: z.string().optional(),
});
export type BrandFormInput = z.input<typeof brandFormSchema>;
export type BrandFormValues = z.output<typeof brandFormSchema>;
