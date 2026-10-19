import type { PaymentMethod } from './enums.js';
import { formatPKR } from './format.js';

/**
 * Which payment methods checkout offers (SPEC §6.5).
 */

export interface PaymentSettings {
  paymentMethods: { cod: boolean; bankTransfer: boolean };
  /** COD is not offered above this order total; null = no limit. */
  codMaxOrderAmount: number | null;
}

export interface PaymentOption {
  method: PaymentMethod;
  /** Enabled in settings at all. Disabled methods are not shown. */
  enabled: boolean;
  /** Can be chosen for this total. */
  available: boolean;
  /** Why an enabled method can't be chosen ("Cash on delivery is available for orders up to Rs X."). */
  reason: string | null;
}

export function codLimitMessage(limit: number): string {
  return `Cash on delivery is available for orders up to ${formatPKR(limit)}.`;
}

export function paymentOptions(settings: PaymentSettings, total: number): PaymentOption[] {
  const codOverLimit = settings.codMaxOrderAmount !== null && total > settings.codMaxOrderAmount;
  return [
    {
      method: 'COD',
      enabled: settings.paymentMethods.cod,
      available: settings.paymentMethods.cod && !codOverLimit,
      reason:
        settings.paymentMethods.cod && codOverLimit && settings.codMaxOrderAmount !== null
          ? codLimitMessage(settings.codMaxOrderAmount)
          : null,
    },
    {
      method: 'BANK_TRANSFER',
      enabled: settings.paymentMethods.bankTransfer,
      available: settings.paymentMethods.bankTransfer,
      reason: null,
    },
  ];
}

export function isPaymentMethodAllowed(
  method: PaymentMethod,
  settings: PaymentSettings,
  total: number,
): boolean {
  return paymentOptions(settings, total).some((option) => option.method === method && option.available);
}
