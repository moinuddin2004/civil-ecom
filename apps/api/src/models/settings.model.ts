import { DEFAULT_LOW_STOCK_THRESHOLD, PAGE_KEYS, type PageKey } from '@aricon/shared';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument, Types } from 'mongoose';
import { BASE_SCHEMA_OPTIONS, COUNT, emailValidator, maxItems, MONEY, pkPhoneValidator, type Lean, TimestampedEntity } from './common.js';

export const SETTINGS_ID = 'settings';
export const DEFAULT_STORE_NAME = 'Aricon Shop';
export const DEFAULT_DELIVERY_FEE = 500;

const VALUE = { _id: false, strict: true } as const;

@Schema({ strict: true })
export class BankAccount {
  _id!: Types.ObjectId;
  @Prop({ type: String, required: true, trim: true, maxlength: 80 }) bankName!: string;
  @Prop({ type: String, required: true, trim: true, maxlength: 120 }) accountTitle!: string;
  @Prop({ type: String, required: true, trim: true, maxlength: 40 }) accountNumber!: string;
  @Prop({ type: String, trim: true, uppercase: true, maxlength: 34 }) iban?: string;
  @Prop({ type: String, trim: true, maxlength: 40 }) raastId?: string;
}

@Schema(VALUE)
export class PaymentMethods {
  @Prop({ type: Boolean, required: true, default: true }) cod!: boolean;
  @Prop({ type: Boolean, required: true, default: true }) bankTransfer!: boolean;
}

const pageText = { type: String, default: '', maxlength: 50_000 };

/** Markdown for each content page. */
@Schema(VALUE)
export class Pages implements Record<PageKey, string> {
  @Prop(pageText) about!: string;
  @Prop(pageText) faq!: string;
  @Prop(pageText) contact!: string;
  @Prop(pageText) refundPolicy!: string;
  @Prop(pageText) deliveryPolicy!: string;
  @Prop(pageText) privacyPolicy!: string;
  @Prop(pageText) terms!: string;
}

const emailText = { type: String, trim: true, lowercase: true, maxlength: 254, default: '', validate: emailValidator };

/**
 * `settings` (SPEC §5.14): a single document with `_id: 'settings'`, edited by ADMIN only. Read it
 * through `mergeSettings()` so every field has a safe default before an admin first saves it.
 */
@Schema({ ...BASE_SCHEMA_OPTIONS, collection: 'settings', minimize: false })
export class Settings extends TimestampedEntity {
  @Prop({ type: String, enum: [SETTINGS_ID], default: SETTINGS_ID })
  _id!: typeof SETTINGS_ID;

  @Prop({ type: String, required: true, trim: true, maxlength: 80, default: DEFAULT_STORE_NAME }) storeName!: string;
  @Prop({ type: String, trim: true, maxlength: 30, default: '' }) phone!: string;

  /** `+923XXXXXXXXX`, or '' when not set. */
  @Prop({
    type: String,
    default: '',
    validate: {
      validator: (value: unknown) => value === '' || pkPhoneValidator.validator(value),
      message: pkPhoneValidator.message,
    },
  })
  whatsapp!: string;

  @Prop(emailText) email!: string;
  @Prop({ type: String, trim: true, maxlength: 300, default: '' }) address!: string;

  /** New order and receipt alerts. */
  @Prop({
    type: [{ type: String, trim: true, lowercase: true, maxlength: 254, validate: emailValidator }],
    default: [],
    validate: maxItems(10, 'Add at most 10 notification emails.'),
  })
  orderNotificationEmails!: string[];

  /** Where company-website inquiries go. */
  @Prop(emailText) rfpEmail!: string;

  /** At least one must be on. */
  @Prop({ type: SchemaFactory.createForClass(PaymentMethods), default: () => ({}) })
  paymentMethods!: PaymentMethods;

  /** COD is not offered above this total; null = no limit. */
  @Prop({ ...MONEY, default: null }) codMaxOrderAmount!: number | null;

  /** Used when a delivery area has no fee of its own. */
  @Prop({ ...MONEY, required: true, default: DEFAULT_DELIVERY_FEE }) defaultDeliveryFee!: number;

  @Prop({
    type: [SchemaFactory.createForClass(BankAccount)],
    default: [],
    validate: maxItems(10, 'Add at most 10 bank accounts.'),
  })
  bankAccounts!: BankAccount[];

  /** Markdown. */
  @Prop({ type: String, default: '', maxlength: 5_000 }) bankTransferInstructions!: string;

  @Prop({ ...COUNT, required: true, default: DEFAULT_LOW_STOCK_THRESHOLD, max: 1_000_000 }) lowStockDefault!: number;

  @Prop({ type: SchemaFactory.createForClass(Pages), default: () => ({}) })
  pages!: Pages;
}

export type SettingsDocument = HydratedDocument<Settings>;
export type SettingsLean = Lean<Settings>;
export const SettingsSchema = SchemaFactory.createForClass(Settings);

// "At least one must be true" (SPEC §5.14): checkout needs a way to pay.
SettingsSchema.pre('validate', function () {
  if (!this.paymentMethods.cod && !this.paymentMethods.bankTransfer) {
    this.invalidate('paymentMethods', 'Keep at least one payment method on.');
  }
});

/** Settings as services use them; `updatedAt` is null until an admin first saves them. */
export type StoreSettings = Omit<Settings, 'bankAccounts' | 'createdAt' | 'updatedAt'> & {
  bankAccounts: (Omit<BankAccount, '_id'> & { _id?: Types.ObjectId })[];
  updatedAt: Date | null;
};

/** Defaults used before an admin saves the settings. A fresh object each call (arrays inside). */
export function defaultSettings(): StoreSettings {
  return {
    _id: SETTINGS_ID,
    storeName: DEFAULT_STORE_NAME,
    phone: '',
    whatsapp: '',
    email: '',
    address: '',
    orderNotificationEmails: [],
    rfpEmail: '',
    paymentMethods: { cod: true, bankTransfer: true },
    codMaxOrderAmount: null,
    defaultDeliveryFee: DEFAULT_DELIVERY_FEE,
    bankAccounts: [],
    bankTransferInstructions: '',
    lowStockDefault: DEFAULT_LOW_STOCK_THRESHOLD,
    pages: Object.fromEntries(PAGE_KEYS.map((key) => [key, ''])) as Record<PageKey, string>,
    updatedAt: null,
  };
}

/**
 * The stored settings merged over `defaultSettings()`, so callers always get every field even
 * before an admin has saved the settings (or after a new field is added).
 */
export function mergeSettings(stored: Partial<SettingsLean> | null): StoreSettings {
  const defaults = defaultSettings();
  if (!stored) return defaults;
  return {
    _id: SETTINGS_ID,
    storeName: stored.storeName ?? defaults.storeName,
    phone: stored.phone ?? defaults.phone,
    whatsapp: stored.whatsapp ?? defaults.whatsapp,
    email: stored.email ?? defaults.email,
    address: stored.address ?? defaults.address,
    orderNotificationEmails: stored.orderNotificationEmails ?? defaults.orderNotificationEmails,
    rfpEmail: stored.rfpEmail ?? defaults.rfpEmail,
    paymentMethods: {
      cod: stored.paymentMethods?.cod ?? defaults.paymentMethods.cod,
      bankTransfer: stored.paymentMethods?.bankTransfer ?? defaults.paymentMethods.bankTransfer,
    },
    // null is a real value here ("no limit"); only a missing field falls back.
    codMaxOrderAmount: stored.codMaxOrderAmount === undefined ? defaults.codMaxOrderAmount : stored.codMaxOrderAmount,
    defaultDeliveryFee: stored.defaultDeliveryFee ?? defaults.defaultDeliveryFee,
    bankAccounts: stored.bankAccounts ?? defaults.bankAccounts,
    bankTransferInstructions: stored.bankTransferInstructions ?? defaults.bankTransferInstructions,
    lowStockDefault: stored.lowStockDefault ?? defaults.lowStockDefault,
    pages: Object.fromEntries(PAGE_KEYS.map((key) => [key, stored.pages?.[key] ?? defaults.pages[key]])) as Record<
      PageKey,
      string
    >,
    updatedAt: stored.updatedAt ?? null,
  };
}
