import { z } from 'zod';
import { DEFAULT_CITY } from '../constants.js';
import {
  clearableText,
  nameSchema,
  objectIdSchema,
  optionalText,
  pkPhoneSchema,
  requiredText,
} from './common.js';

/** Customer profile and saved addresses (SPEC §5.1, §7.2 "Account"). */

export const profileSchema = z.strictObject({
  name: nameSchema,
  phone: pkPhoneSchema,
  companyName: clearableText(120).optional(),
});
export type ProfileInput = z.input<typeof profileSchema>;

export const addressSchema = z.strictObject({
  label: requiredText(1, 60, 'Label'),
  contactName: nameSchema,
  phone: pkPhoneSchema,
  line1: requiredText(3, 200),
  line2: optionalText(200),
  landmark: optionalText(200),
  areaId: objectIdSchema,
  city: z.string().trim().min(2).max(60).default(DEFAULT_CITY),
  isDefault: z.boolean().optional(),
});
export type AddressInput = z.input<typeof addressSchema>;
export type AddressData = z.output<typeof addressSchema>;
