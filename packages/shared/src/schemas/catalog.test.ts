import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
  bannerSchema,
  categoryCreateSchema,
  deliveryAreaCreateSchema,
  deliveryAreaUpdateSchema,
  homepageSchema,
  rfpSchema,
  riderCreateSchema,
} from './catalog.js';

const ok = (schema: z.ZodType, input: unknown) => schema.safeParse(input).success;
const id = (n: number) => `64b7f0c2e4b0a1a2b3c4d5${String(n).padStart(2, '0')}`;

describe('delivery areas (SPEC §5.8)', () => {
  it('defaults to serviceable, default fee and no free delivery in Karachi', () => {
    expect(deliveryAreaCreateSchema.parse({ name: 'Gulshan-e-Iqbal' })).toEqual({
      name: 'Gulshan-e-Iqbal',
      city: 'Karachi',
      isServiceable: true,
      deliveryFee: null,
      freeDeliveryAbove: null,
      sortOrder: 0,
    });
  });

  it('accepts a fee of 0 but only whole, non-negative rupees', () => {
    expect(ok(deliveryAreaCreateSchema, { name: 'DHA', deliveryFee: 0, freeDeliveryAbove: 50_000 })).toBe(true);
    expect(ok(deliveryAreaCreateSchema, { name: 'DHA', deliveryFee: 250.5 })).toBe(false);
    expect(ok(deliveryAreaCreateSchema, { name: 'DHA', deliveryFee: -1 })).toBe(false);
    expect(ok(deliveryAreaUpdateSchema, { freeDeliveryAbove: null })).toBe(true);
  });
});

describe('categoryCreateSchema', () => {
  it('makes a top-level category by default and normalises the slug', () => {
    expect(categoryCreateSchema.parse({ name: 'Cement', slug: 'Cement-Bags' })).toMatchObject({
      parentId: null,
      slug: 'cement-bags',
      status: 'active',
      showOnHome: false,
    });
    expect(ok(categoryCreateSchema, { name: 'Cement', slug: 'cement bags' })).toBe(false);
  });
});

describe('bannerSchema links', () => {
  const banner = { id: id(1), desktopKey: `banners/${id(1)}/desktop.webp`, alt: 'Monsoon sale' };

  it.each(['/category/cement', 'https://aricon.com.pk/offers'])('accepts %j', (link) => {
    expect(ok(bannerSchema, { ...banner, link })).toBe(true);
  });

  it.each(['http://aricon.com.pk', '//evil.example', 'javascript:alert(1)', 'category/cement', 'data:text/html,x'])(
    'rejects %j',
    (link) => {
      expect(ok(bannerSchema, { ...banner, link })).toBe(false);
    },
  );

  it('only accepts image keys from the upload endpoint', () => {
    expect(ok(bannerSchema, { ...banner, desktopKey: 'banners/x/desktop.webp' })).toBe(false);
    expect(ok(bannerSchema, { ...banner, mobileKey: `banners/${id(1)}/desktop.webp` })).toBe(false);
  });
});

describe('homepageSchema (SPEC §5.13)', () => {
  const ids = (n: number) => Array.from({ length: n }, (_, i) => id(i));

  it('allows up to 8 banners and 12 unique products per list', () => {
    expect(ok(homepageSchema, { banners: [], featuredProductIds: ids(12), dealProductIds: ids(12) })).toBe(true);
    expect(ok(homepageSchema, { banners: [], featuredProductIds: ids(13), dealProductIds: [] })).toBe(false);
    expect(ok(homepageSchema, { banners: [], featuredProductIds: [id(1), id(1)], dealProductIds: [] })).toBe(false);
    const banner = { id: id(1), desktopKey: `banners/${id(1)}/desktop.webp`, alt: 'Sale' };
    expect(ok(homepageSchema, { banners: Array.from({ length: 9 }, () => banner), featuredProductIds: [], dealProductIds: [] })).toBe(
      false,
    );
  });
});

describe('riders and RFP', () => {
  it('normalises the rider phone', () => {
    expect(riderCreateSchema.parse({ name: 'Rashid Ali', phone: '0333 1234567' })).toEqual({
      name: 'Rashid Ali',
      phone: '+923331234567',
      isActive: true,
    });
  });

  it('accepts an inquiry with an empty honeypot and needs a real brief', () => {
    const rfp = {
      company: 'Khan Builders',
      contactPerson: 'Imran Khan',
      email: 'imran@example.com',
      service: 'Waterproofing',
      brief: 'Roof waterproofing for a 3-storey building.',
      website: '',
    };
    expect(ok(rfpSchema, rfp)).toBe(true);
    expect(ok(rfpSchema, { ...rfp, brief: 'Call me' })).toBe(false);
    expect(ok(rfpSchema, { ...rfp, budget: '1m' })).toBe(false);
  });
});
