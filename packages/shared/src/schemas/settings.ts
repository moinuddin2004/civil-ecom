import { z } from 'zod';
import { PAGE_KEYS, STAFF_ROLES, USER_STATUSES } from '../enums.js';
import { isPermission } from '../permissions.js';
import {
  clearableText,
  emailSchema,
  moneySchema,
  nameSchema,
  objectIdSchema,
  optionalText,
  pkPhoneSchema,
  requiredText,
} from './common.js';

/** Store settings (SPEC §5.14) and staff management (SPEC §4, §7.3) — ADMIN only. */

export const bankAccountSchema = z.strictObject({
  id: objectIdSchema.optional(),
  bankName: requiredText(2, 80, 'Bank name'),
  accountTitle: requiredText(2, 120, 'Account title'),
  accountNumber: requiredText(4, 40, 'Account number'),
  iban: z
    .string()
    .trim()
    .toUpperCase()
    .transform((value) => value.replace(/\s+/g, ''))
    .refine((value) => value === '' || /^PK\d{2}[A-Z]{4}[A-Z0-9]{16}$/.test(value), 'Enter a Pakistani IBAN, like PK36MEZN0001010104567890.')
    .optional()
    .transform((value) => (value ? value : undefined)),
  raastId: optionalText(40),
});
export type BankAccountInput = z.input<typeof bankAccountSchema>;

const pageText = z.string().max(50_000, 'This page is too long.');

export const pagesSchema = z.strictObject(
  Object.fromEntries(PAGE_KEYS.map((key) => [key, pageText])) as Record<(typeof PAGE_KEYS)[number], typeof pageText>,
);

export const settingsSchema = z
  .strictObject({
    storeName: requiredText(2, 80, 'Store name'),
    /** Landline or mobile, shown as written. */
    phone: requiredText(5, 30, 'Phone'),
    whatsapp: pkPhoneSchema,
    email: emailSchema,
    address: requiredText(5, 300, 'Address'),
    orderNotificationEmails: z.array(emailSchema).max(10, 'Add at most 10 addresses.'),
    rfpEmail: emailSchema,
    paymentMethods: z.strictObject({ cod: z.boolean(), bankTransfer: z.boolean() }),
    /** null = no limit. */
    codMaxOrderAmount: moneySchema.nullable(),
    defaultDeliveryFee: moneySchema,
    bankAccounts: z.array(bankAccountSchema).max(10, 'Add at most 10 bank accounts.'),
    bankTransferInstructions: z.string().max(5_000),
    lowStockDefault: z.number().int().min(0).max(1_000_000),
    pages: pagesSchema,
  })
  .refine((value) => value.paymentMethods.cod || value.paymentMethods.bankTransfer, {
    path: ['paymentMethods'],
    message: 'Keep at least one payment method on.',
  });
export type SettingsInput = z.input<typeof settingsSchema>;
export type SettingsData = z.output<typeof settingsSchema>;

const permissionList = z
  .array(z.string())
  .max(50)
  .superRefine((keys, ctx) => {
    keys.forEach((key, index) => {
      if (!isPermission(key)) {
        ctx.addIssue({ code: 'custom', path: [index], message: `Unknown permission "${key}".` });
      }
    });
  });

export const staffCreateSchema = z.strictObject({
  name: nameSchema,
  email: emailSchema,
  phone: pkPhoneSchema.optional(),
  role: z.enum(STAFF_ROLES),
  permissions: permissionList.default([]),
});
export type StaffCreateInput = z.input<typeof staffCreateSchema>;

export const staffUpdateSchema = z.strictObject({
  name: nameSchema.optional(),
  phone: pkPhoneSchema.nullable().optional(),
  role: z.enum(STAFF_ROLES).optional(),
  permissions: permissionList.optional(),
  status: z.enum(USER_STATUSES).optional(),
});
export type StaffUpdateInput = z.input<typeof staffUpdateSchema>;

export const customerStatusNoteSchema = z.strictObject({ note: clearableText(500).optional() });
