import { describe, expect, it } from 'vitest';
import {
  PRODUCT_IMAGE_WIDTHS,
  bannerImageKey,
  brandLogoKey,
  categoryImageKey,
  imageUrl,
  importFileKey,
  pickProductImageWidth,
  productImageFileKey,
  productImagePrefix,
  receiptKey,
} from './images.js';

describe('storage keys (SPEC §12.1)', () => {
  it('builds product image keys in three widths under one prefix', () => {
    const prefix = productImagePrefix('p1', 'i1');
    expect(prefix).toBe('products/p1/i1');
    expect(PRODUCT_IMAGE_WIDTHS.map((w) => productImageFileKey(prefix, w))).toEqual([
      'products/p1/i1/300.webp',
      'products/p1/i1/800.webp',
      'products/p1/i1/1600.webp',
    ]);
  });

  it('builds banner, category, brand, receipt and import keys', () => {
    expect(bannerImageKey('b1', 'desktop')).toBe('banners/b1/desktop.webp');
    expect(bannerImageKey('b1', 'mobile')).toBe('banners/b1/mobile.webp');
    expect(categoryImageKey('c1')).toBe('categories/c1/image.webp');
    expect(brandLogoKey('br1')).toBe('brands/br1/logo.webp');
    expect(receiptKey('o1', 'r1', 'pdf')).toBe('receipts/o1/r1.pdf');
    expect(importFileKey('j1')).toBe('imports/j1.xlsx');
  });
});

describe('imageUrl and pickProductImageWidth', () => {
  it('joins the base URL and key without double slashes', () => {
    expect(imageUrl('https://img.example.com/', 'banners/b1/desktop.webp')).toBe(
      'https://img.example.com/banners/b1/desktop.webp',
    );
    expect(imageUrl('https://img.example.com//', 'products/p1/i1', 800)).toBe(
      'https://img.example.com/products/p1/i1/800.webp',
    );
  });

  it('picks the smallest stored width that covers the request', () => {
    expect(pickProductImageWidth(1)).toBe(300);
    expect(pickProductImageWidth(300)).toBe(300);
    expect(pickProductImageWidth(301)).toBe(800);
    expect(pickProductImageWidth(1600)).toBe(1600);
    expect(pickProductImageWidth(3840)).toBe(1600);
  });
});
