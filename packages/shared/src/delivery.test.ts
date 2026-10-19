import { describe, expect, it } from 'vitest';
import {
  AreaNotServiceableError,
  baseDeliveryFee,
  getDeliveryFee,
  notServiceableMessage,
  type DeliveryAreaPricing,
} from './delivery.js';

const settings = { defaultDeliveryFee: 500 };
const area: DeliveryAreaPricing = {
  name: 'Gulshan-e-Iqbal',
  isServiceable: true,
  deliveryFee: 300,
  freeDeliveryAbove: 50_000,
};

describe('baseDeliveryFee (SPEC §6.4)', () => {
  it('uses the area fee, or the default fee when the area has none', () => {
    expect(baseDeliveryFee(area, settings)).toBe(300);
    expect(baseDeliveryFee({ ...area, deliveryFee: null }, settings)).toBe(500);
  });

  it('keeps an area fee of 0 instead of falling back to the default', () => {
    expect(baseDeliveryFee({ ...area, deliveryFee: 0 }, settings)).toBe(0);
  });
});

describe('getDeliveryFee (SPEC §6.4)', () => {
  it.each([
    [0, 300, 50_000],
    [1, 300, 49_999],
    [49_999, 300, 1],
    [50_000, 0, 0],
    [50_001, 0, 0],
    [1_000_000, 0, 0],
  ])('subtotal Rs %i → fee %i, %i to free delivery', (subtotal, fee, amountToFreeDelivery) => {
    expect(getDeliveryFee(subtotal, area, settings)).toEqual({ fee, amountToFreeDelivery });
  });

  it('never makes delivery free when the area has no threshold', () => {
    const noFree = { ...area, freeDeliveryAbove: null };
    expect(getDeliveryFee(0, noFree, settings)).toEqual({ fee: 300, amountToFreeDelivery: null });
    expect(getDeliveryFee(10_000_000, noFree, settings)).toEqual({ fee: 300, amountToFreeDelivery: null });
  });

  it('falls back to the default fee below the threshold', () => {
    const defaultFee = { ...area, deliveryFee: null };
    expect(getDeliveryFee(10_000, defaultFee, settings)).toEqual({ fee: 500, amountToFreeDelivery: 40_000 });
    expect(getDeliveryFee(50_000, defaultFee, settings)).toEqual({ fee: 0, amountToFreeDelivery: 0 });
  });

  it('treats a threshold of 0 as always free', () => {
    expect(getDeliveryFee(0, { ...area, freeDeliveryAbove: 0 }, settings)).toEqual({ fee: 0, amountToFreeDelivery: 0 });
  });

  it('throws for an area that is not serviceable, with the customer message', () => {
    const malir = { ...area, name: 'Malir', isServiceable: false };
    expect(() => getDeliveryFee(10_000, malir, settings)).toThrow(AreaNotServiceableError);
    expect(() => getDeliveryFee(10_000, malir, settings)).toThrow("We don't deliver to Malir yet.");
    try {
      getDeliveryFee(10_000, malir, settings);
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as AreaNotServiceableError).areaName).toBe('Malir');
      expect((error as AreaNotServiceableError).name).toBe('AreaNotServiceableError');
    }
  });

  it('throws for an unserviceable area even above its free-delivery threshold', () => {
    expect(() => getDeliveryFee(90_000, { ...area, isServiceable: false }, settings)).toThrow(AreaNotServiceableError);
  });
});

describe('notServiceableMessage', () => {
  it('names the area (SPEC §6.4 wording)', () => {
    expect(notServiceableMessage('Gadap')).toBe("We don't deliver to Gadap yet.");
  });
});
