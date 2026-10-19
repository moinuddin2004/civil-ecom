/**
 * Delivery charges (SPEC §6.4). Pure; money is integer PKR.
 */

export interface DeliveryAreaPricing {
  name: string;
  isServiceable: boolean;
  /** null → `settings.defaultDeliveryFee`. */
  deliveryFee: number | null;
  /** null → no free delivery in this area. */
  freeDeliveryAbove: number | null;
}

export interface DeliverySettings {
  defaultDeliveryFee: number;
}

export interface DeliveryFeeResult {
  fee: number;
  /**
   * Rupees still needed for free delivery: 0 once reached, null when the area has no
   * free-delivery threshold.
   */
  amountToFreeDelivery: number | null;
}

export class AreaNotServiceableError extends Error {
  override readonly name = 'AreaNotServiceableError';
  constructor(readonly areaName: string) {
    super(`We don't deliver to ${areaName} yet.`);
  }
}

/** The fee the area charges before any free-delivery threshold. */
export function baseDeliveryFee(area: DeliveryAreaPricing, settings: DeliverySettings): number {
  return area.deliveryFee ?? settings.defaultDeliveryFee;
}

/**
 * Delivery fee for an order subtotal. The area must be serviceable: callers check
 * `area.isServiceable` first (checkout is blocked otherwise); this throws
 * `AreaNotServiceableError` as a guard.
 */
export function getDeliveryFee(
  subtotal: number,
  area: DeliveryAreaPricing,
  settings: DeliverySettings,
): DeliveryFeeResult {
  if (!area.isServiceable) throw new AreaNotServiceableError(area.name);

  const fee = baseDeliveryFee(area, settings);
  if (area.freeDeliveryAbove === null) return { fee, amountToFreeDelivery: null };
  if (subtotal >= area.freeDeliveryAbove) return { fee: 0, amountToFreeDelivery: 0 };
  return { fee, amountToFreeDelivery: area.freeDeliveryAbove - subtotal };
}

/** Customer-facing message for an unserviceable area (SPEC §6.4). */
export function notServiceableMessage(areaName: string): string {
  return `We don't deliver to ${areaName} yet.`;
}
