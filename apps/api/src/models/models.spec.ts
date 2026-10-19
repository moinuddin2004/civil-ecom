import { describe, expect, it } from 'vitest';
import { computeProductDerived } from './product.model.js';
import { defaultSettings, mergeSettings, type SettingsLean } from './settings.model.js';

describe('computeProductDerived (SPEC §5.6)', () => {
  it('derives filters, price range and stock from active variants only', () => {
    const derived = computeProductDerived(
      [
        { options: { packSize: '20 kg', colour: 'White' }, price: 900, stock: 10, isActive: true },
        { options: { packSize: '5 kg', colour: 'White' }, price: 300, stock: 4, isActive: true },
        { options: { packSize: '50 kg' }, price: 50, stock: 99, isActive: false },
      ],
      ' Emulsion ',
    );
    expect(derived).toEqual({
      // Natural sort: "5 kg" before "20 kg"; the inactive 50 kg variant is ignored.
      filters: { type: ['Emulsion'], packSize: ['5 kg', '20 kg'], grade: [], colour: ['White'], size: [] },
      minPrice: 300,
      maxPrice: 900,
      totalStock: 14,
    });
  });

  it('is zero when no variant is active', () => {
    expect(computeProductDerived([{ price: 100, stock: 5, isActive: false }], null)).toMatchObject({
      minPrice: 0,
      maxPrice: 0,
      totalStock: 0,
      filters: { type: [] },
    });
  });
});

describe('mergeSettings (SPEC §5.14)', () => {
  it('gives safe defaults before an admin saves anything', () => {
    expect(mergeSettings(null)).toEqual(defaultSettings());
    expect(defaultSettings().paymentMethods).toEqual({ cod: true, bankTransfer: true });
  });

  it('keeps a stored null COD limit ("no limit") and fills missing fields', () => {
    const stored = { codMaxOrderAmount: null, paymentMethods: { cod: false }, pages: { faq: '## FAQ' } } as unknown as Partial<SettingsLean>;
    const merged = mergeSettings(stored);
    expect(merged.codMaxOrderAmount).toBeNull();
    expect(merged.paymentMethods).toEqual({ cod: false, bankTransfer: true });
    expect(merged.pages.faq).toBe('## FAQ');
    expect(merged.pages.about).toBe('');
    expect(merged.defaultDeliveryFee).toBe(500);
  });
});
