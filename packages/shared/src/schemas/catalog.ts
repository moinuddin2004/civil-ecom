import { z } from 'zod';
import { DEFAULT_CITY, MAX_BANNERS, MAX_HOMEPAGE_PRODUCTS } from '../constants.js';
import { CATALOG_STATUSES } from '../enums.js';
import {
  clearableText,
  emailSchema,
  moneySchema,
  nameSchema,
  objectIdSchema,
  optionalText,
  pkPhoneSchema,
  requiredText,
  slugSchema,
} from './common.js';

/** Categories, brands, delivery areas, riders and the homepage (SPEC §5.4–5.5, §5.8–5.9, §5.13). */

const sortOrder = z.number().int().min(-100_000).max(100_000);

const categoryImageKey = z.string().regex(/^categories\/[a-f\d]{24}\/image\.webp$/, 'Upload the image again.');
const brandLogoKey = z.string().regex(/^brands\/[a-f\d]{24}\/logo\.webp$/, 'Upload the logo again.');

export const categoryCreateSchema = z.strictObject({
  id: objectIdSchema.optional(),
  name: requiredText(2, 80, 'Name'),
  slug: slugSchema.optional(),
  /** null = top level. Categories are at most two levels deep. */
  parentId: objectIdSchema.nullable().default(null),
  description: optionalText(2_000),
  imageKey: categoryImageKey.nullable().optional(),
  sortOrder: sortOrder.default(0),
  showOnHome: z.boolean().default(false),
  status: z.enum(CATALOG_STATUSES).default('active'),
});
export type CategoryCreateInput = z.input<typeof categoryCreateSchema>;

export const categoryUpdateSchema = z.strictObject({
  name: requiredText(2, 80, 'Name').optional(),
  slug: slugSchema.optional(),
  parentId: objectIdSchema.nullable().optional(),
  description: clearableText(2_000).optional(),
  imageKey: categoryImageKey.nullable().optional(),
  sortOrder: sortOrder.optional(),
  showOnHome: z.boolean().optional(),
  status: z.enum(CATALOG_STATUSES).optional(),
});
export type CategoryUpdateInput = z.input<typeof categoryUpdateSchema>;

export const brandCreateSchema = z.strictObject({
  id: objectIdSchema.optional(),
  name: requiredText(2, 80, 'Name'),
  slug: slugSchema.optional(),
  logoKey: brandLogoKey.nullable().optional(),
  sortOrder: sortOrder.default(0),
  status: z.enum(CATALOG_STATUSES).default('active'),
});
export type BrandCreateInput = z.input<typeof brandCreateSchema>;

export const brandUpdateSchema = z.strictObject({
  name: requiredText(2, 80, 'Name').optional(),
  slug: slugSchema.optional(),
  logoKey: brandLogoKey.nullable().optional(),
  sortOrder: sortOrder.optional(),
  status: z.enum(CATALOG_STATUSES).optional(),
});
export type BrandUpdateInput = z.input<typeof brandUpdateSchema>;

export const deliveryAreaCreateSchema = z.strictObject({
  name: requiredText(2, 80, 'Name'),
  city: z.string().trim().min(2).max(60).default(DEFAULT_CITY),
  isServiceable: z.boolean().default(true),
  /** null → the default delivery fee from settings. */
  deliveryFee: moneySchema.nullable().default(null),
  /** null → no free delivery. */
  freeDeliveryAbove: moneySchema.nullable().default(null),
  sortOrder: sortOrder.default(0),
});
export type DeliveryAreaCreateInput = z.input<typeof deliveryAreaCreateSchema>;

export const deliveryAreaUpdateSchema = z.strictObject({
  name: requiredText(2, 80, 'Name').optional(),
  city: z.string().trim().min(2).max(60).optional(),
  isServiceable: z.boolean().optional(),
  deliveryFee: moneySchema.nullable().optional(),
  freeDeliveryAbove: moneySchema.nullable().optional(),
  sortOrder: sortOrder.optional(),
});
export type DeliveryAreaUpdateInput = z.input<typeof deliveryAreaUpdateSchema>;

export const riderCreateSchema = z.strictObject({
  name: nameSchema,
  phone: pkPhoneSchema,
  isActive: z.boolean().default(true),
});
export type RiderCreateInput = z.input<typeof riderCreateSchema>;

export const riderUpdateSchema = z.strictObject({
  name: nameSchema.optional(),
  phone: pkPhoneSchema.optional(),
  isActive: z.boolean().optional(),
});
export type RiderUpdateInput = z.input<typeof riderUpdateSchema>;

/** Relative path on this site (`/category/cement`) or an https URL. */
const bannerLink = z
  .string()
  .trim()
  .max(500)
  .refine((value) => /^\/(?!\/)/.test(value) || /^https:\/\//.test(value), 'Use a path like /category/cement or an https:// link.');

export const bannerSchema = z.strictObject({
  id: objectIdSchema,
  desktopKey: z.string().regex(/^banners\/[a-f\d]{24}\/desktop\.webp$/, 'Upload the desktop image again.'),
  mobileKey: z
    .string()
    .regex(/^banners\/[a-f\d]{24}\/mobile\.webp$/, 'Upload the mobile image again.')
    .nullable()
    .default(null),
  alt: requiredText(1, 150, 'Alt text'),
  link: bannerLink.nullable().default(null),
  isActive: z.boolean().default(true),
  sortOrder: sortOrder.default(0),
});

const productIdList = z
  .array(objectIdSchema)
  .max(MAX_HOMEPAGE_PRODUCTS, `Pick at most ${MAX_HOMEPAGE_PRODUCTS} products.`)
  .refine((ids) => new Set(ids).size === ids.length, 'Each product can be picked once.');

export const homepageSchema = z.strictObject({
  banners: z.array(bannerSchema).max(MAX_BANNERS, `Add at most ${MAX_BANNERS} banners.`),
  featuredProductIds: productIdList,
  dealProductIds: productIdList,
});
export type HomepageInput = z.input<typeof homepageSchema>;

/** Company-website inquiry (SPEC §7.2 "Company website inquiries"). `website` is a honeypot. */
export const rfpSchema = z.strictObject({
  company: requiredText(2, 120, 'Company'),
  contactPerson: nameSchema,
  email: emailSchema,
  phone: optionalText(30),
  location: optionalText(120),
  service: requiredText(2, 120, 'Service'),
  brief: requiredText(10, 5_000, 'Brief'),
  website: z.string().max(500).optional(),
});
export type RfpInput = z.input<typeof rfpSchema>;
