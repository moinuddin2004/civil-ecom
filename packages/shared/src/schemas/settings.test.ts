import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { PAGE_KEYS } from '../enums.js';
import { bankAccountSchema, settingsSchema, staffCreateSchema, staffUpdateSchema } from './settings.js';

function issues(schema: z.ZodType, input: unknown) {
  const result = schema.safeParse(input);
  return result.success ? [] : result.error.issues.map(({ path, message, code }) => ({ path, message, code }));
}

const pages = Object.fromEntries(PAGE_KEYS.map((key) => [key, `# ${key}`]));

const settings = {
  storeName: 'Aricon Shop',
  phone: '021 34567890',
  whatsapp: '0300 1234567',
  email: 'Shop@Aricon.com.pk',
  address: 'Shahrah-e-Faisal, Karachi',
  orderNotificationEmails: ['Orders@Aricon.com.pk'],
  rfpEmail: 'info@aricon.com.pk',
  paymentMethods: { cod: true, bankTransfer: true },
  codMaxOrderAmount: 200_000,
  defaultDeliveryFee: 500,
  bankAccounts: [
    {
      bankName: 'Meezan Bank',
      accountTitle: 'Aricon (Pvt) Ltd',
      accountNumber: '0101-0104567890',
      iban: 'pk36 mezn 0001 0101 0456 7890',
    },
  ],
  bankTransferInstructions: 'Send the receipt from your order page.',
  lowStockDefault: 5,
  pages,
};

describe('settingsSchema (SPEC §5.14)', () => {
  it('parses valid settings and normalises emails, WhatsApp and IBAN', () => {
    const data = settingsSchema.parse(settings);
    expect(data.email).toBe('shop@aricon.com.pk');
    expect(data.orderNotificationEmails).toEqual(['orders@aricon.com.pk']);
    expect(data.whatsapp).toBe('+923001234567');
    expect(data.phone).toBe('021 34567890');
    expect(data.bankAccounts[0]?.iban).toBe('PK36MEZN0001010104567890');
  });

  it('requires at least one payment method', () => {
    expect(issues(settingsSchema, { ...settings, paymentMethods: { cod: false, bankTransfer: false } })).toEqual([
      { path: ['paymentMethods'], message: 'Keep at least one payment method on.', code: 'custom' },
    ]);
    expect(issues(settingsSchema, { ...settings, paymentMethods: { cod: false, bankTransfer: true } })).toEqual([]);
    expect(issues(settingsSchema, { ...settings, paymentMethods: { cod: true, bankTransfer: false } })).toEqual([]);
  });

  it('allows no COD limit (null) but only whole, non-negative rupees otherwise', () => {
    expect(issues(settingsSchema, { ...settings, codMaxOrderAmount: null })).toEqual([]);
    expect(issues(settingsSchema, { ...settings, codMaxOrderAmount: 150_000.5 }).map((i) => i.path)).toEqual([
      ['codMaxOrderAmount'],
    ]);
    expect(issues(settingsSchema, { ...settings, codMaxOrderAmount: -1 }).map((i) => i.path)).toEqual([
      ['codMaxOrderAmount'],
    ]);
    expect(issues(settingsSchema, { ...settings, defaultDeliveryFee: 99.9 }).map((i) => i.path)).toEqual([
      ['defaultDeliveryFee'],
    ]);
  });

  it('needs every content page and no others', () => {
    const { terms: _terms, ...missing } = pages;
    expect(issues(settingsSchema, { ...settings, pages: missing }).map((i) => i.path)).toEqual([['pages', 'terms']]);
    expect(issues(settingsSchema, { ...settings, pages: { ...pages, blog: '' } })[0]?.code).toBe('unrecognized_keys');
  });

  it('rejects unknown settings keys and a bad WhatsApp number', () => {
    expect(issues(settingsSchema, { ...settings, smtpPassword: 'x' })[0]?.code).toBe('unrecognized_keys');
    expect(issues(settingsSchema, { ...settings, whatsapp: '021 34567890' }).map((i) => i.path)).toEqual([['whatsapp']]);
  });

  it('checks notification emails', () => {
    expect(issues(settingsSchema, { ...settings, orderNotificationEmails: ['not-an-email'] }).map((i) => i.path)).toEqual([
      ['orderNotificationEmails', 0],
    ]);
  });
});

describe('bankAccountSchema', () => {
  const account = { bankName: 'HBL', accountTitle: 'Aricon', accountNumber: '12345678' };

  it('treats an empty IBAN as not given and rejects a malformed one', () => {
    expect(bankAccountSchema.parse({ ...account, iban: '' }).iban).toBeUndefined();
    expect(bankAccountSchema.parse(account).iban).toBeUndefined();
    expect(issues(bankAccountSchema, { ...account, iban: 'GB29NWBK60161331926819' }).map((i) => i.path)).toEqual([
      ['iban'],
    ]);
    expect(issues(bankAccountSchema, { ...account, iban: 'PK36MEZN000101010456789' })).not.toEqual([]);
  });
});

describe('staffCreateSchema (SPEC §4.5, §7.3)', () => {
  const staff = { name: 'Sara Ahmed', email: 'Sara@Aricon.com.pk', role: 'STAFF', permissions: ['orders.view'] };

  it('accepts a staff member and defaults permissions to none', () => {
    expect(staffCreateSchema.parse(staff)).toEqual({
      name: 'Sara Ahmed',
      email: 'sara@aricon.com.pk',
      role: 'STAFF',
      permissions: ['orders.view'],
    });
    const { permissions: _p, ...withoutPermissions } = staff;
    expect(staffCreateSchema.parse(withoutPermissions).permissions).toEqual([]);
    expect(staffCreateSchema.parse({ ...staff, phone: '0300 1234567' }).phone).toBe('+923001234567');
  });

  it('rejects unknown permission keys (400), naming each one', () => {
    expect(
      issues(staffCreateSchema, { ...staff, permissions: ['orders.view', 'settings.manage', 'ORDERS.CANCEL'] }),
    ).toEqual([
      { path: ['permissions', 1], message: 'Unknown permission "settings.manage".', code: 'custom' },
      { path: ['permissions', 2], message: 'Unknown permission "ORDERS.CANCEL".', code: 'custom' },
    ]);
  });

  it('only creates ADMIN or STAFF accounts', () => {
    expect(issues(staffCreateSchema, { ...staff, role: 'CUSTOMER' }).map((i) => i.path)).toEqual([['role']]);
    expect(issues(staffCreateSchema, { ...staff, role: 'ADMIN' })).toEqual([]);
  });

  it.each(['password', 'status', 'mustChangePassword'])('rejects %s (set by the server)', (key) => {
    expect(issues(staffCreateSchema, { ...staff, [key]: 'x' })[0]?.code).toBe('unrecognized_keys');
  });
});

describe('staffUpdateSchema', () => {
  it('accepts partial changes and clearing the phone', () => {
    expect(staffUpdateSchema.parse({ status: 'blocked' })).toEqual({ status: 'blocked' });
    expect(staffUpdateSchema.parse({ phone: null })).toEqual({ phone: null });
  });

  it('rejects unknown permissions, the CUSTOMER role, unknown statuses and email changes', () => {
    expect(issues(staffUpdateSchema, { permissions: ['audit.view'] }).map((i) => i.path)).toEqual([['permissions', 0]]);
    expect(issues(staffUpdateSchema, { role: 'CUSTOMER' }).map((i) => i.path)).toEqual([['role']]);
    expect(issues(staffUpdateSchema, { status: 'deleted' }).map((i) => i.path)).toEqual([['status']]);
    expect(issues(staffUpdateSchema, { email: 'new@aricon.com.pk' })[0]?.code).toBe('unrecognized_keys');
  });
});
