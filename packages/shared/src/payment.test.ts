import { describe, expect, it } from 'vitest';
import { PAYMENT_METHODS, type PaymentMethod } from './enums.js';
import { codLimitMessage, isPaymentMethodAllowed, paymentOptions, type PaymentSettings } from './payment.js';

const both: PaymentSettings = { paymentMethods: { cod: true, bankTransfer: true }, codMaxOrderAmount: 200_000 };
const COD_LIMIT_MESSAGE = 'Cash on delivery is available for orders up to Rs 200,000.';

function option(settings: PaymentSettings, total: number, method: PaymentMethod) {
  const found = paymentOptions(settings, total).find((o) => o.method === method);
  if (!found) throw new Error(`No ${method} option`);
  return found;
}

describe('paymentOptions (SPEC §6.5)', () => {
  it('lists every payment method once, in catalog order', () => {
    expect(paymentOptions(both, 1000).map((o) => o.method)).toEqual([...PAYMENT_METHODS]);
  });

  it('offers both methods under the COD limit', () => {
    expect(paymentOptions(both, 150_000)).toEqual([
      { method: 'COD', enabled: true, available: true, reason: null },
      { method: 'BANK_TRANSFER', enabled: true, available: true, reason: null },
    ]);
  });

  it('allows COD when the total equals the limit', () => {
    expect(option(both, 200_000, 'COD')).toEqual({ method: 'COD', enabled: true, available: true, reason: null });
  });

  it('blocks COD one rupee above the limit and explains why', () => {
    expect(option(both, 200_001, 'COD')).toEqual({
      method: 'COD',
      enabled: true,
      available: false,
      reason: COD_LIMIT_MESSAGE,
    });
    expect(option(both, 200_001, 'BANK_TRANSFER').available).toBe(true);
  });

  it('has no COD limit when codMaxOrderAmount is null', () => {
    expect(option({ ...both, codMaxOrderAmount: null }, 50_000_000, 'COD').available).toBe(true);
  });

  it('treats a limit of 0 as "only free orders"', () => {
    expect(option({ ...both, codMaxOrderAmount: 0 }, 0, 'COD').available).toBe(true);
    expect(option({ ...both, codMaxOrderAmount: 0 }, 1, 'COD').reason).toBe(
      'Cash on delivery is available for orders up to Rs 0.',
    );
  });

  it('does not offer or explain a method that is switched off', () => {
    const noCod = { ...both, paymentMethods: { cod: false, bankTransfer: true } };
    expect(option(noCod, 1000, 'COD')).toEqual({ method: 'COD', enabled: false, available: false, reason: null });
    expect(option(noCod, 500_000, 'COD').reason).toBeNull();

    const noBank = { ...both, paymentMethods: { cod: true, bankTransfer: false } };
    expect(option(noBank, 1000, 'BANK_TRANSFER')).toEqual({
      method: 'BANK_TRANSFER',
      enabled: false,
      available: false,
      reason: null,
    });
  });

  it('never limits bank transfer by amount', () => {
    expect(option(both, 900_000_000, 'BANK_TRANSFER').available).toBe(true);
  });
});

describe('isPaymentMethodAllowed', () => {
  it('matches the available flag', () => {
    expect(isPaymentMethodAllowed('COD', both, 200_000)).toBe(true);
    expect(isPaymentMethodAllowed('COD', both, 200_001)).toBe(false);
    expect(isPaymentMethodAllowed('BANK_TRANSFER', both, 200_001)).toBe(true);
    expect(isPaymentMethodAllowed('COD', { ...both, paymentMethods: { cod: false, bankTransfer: true } }, 10)).toBe(false);
    expect(
      isPaymentMethodAllowed('BANK_TRANSFER', { ...both, paymentMethods: { cod: true, bankTransfer: false } }, 10),
    ).toBe(false);
  });
});

describe('codLimitMessage', () => {
  it('formats the limit as rupees', () => {
    expect(codLimitMessage(200_000)).toBe(COD_LIMIT_MESSAGE);
    expect(codLimitMessage(1_250_000)).toBe('Cash on delivery is available for orders up to Rs 1,250,000.');
  });
});
