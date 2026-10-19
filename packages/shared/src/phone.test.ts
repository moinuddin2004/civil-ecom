import { describe, expect, it } from 'vitest';
import { formatPkPhone, isPkMobile, normalizePkPhone, whatsappNumber } from './phone.js';

describe('normalizePkPhone (CLAUDE.md "Phone numbers")', () => {
  it.each([
    '03001234567',
    '0300 1234567',
    '0300-1234567',
    '3001234567',
    '+923001234567',
    '923001234567',
    '00923001234567',
    '  0300 1234567  ',
    '0300 123 4567',
    '(0300) 1234567',
    '+92 300 1234567',
    '+92-300-1234567',
    '+92 (300) 1234567',
    '0092 300 1234567',
  ])('%j → +923001234567', (input) => {
    expect(normalizePkPhone(input)).toBe('+923001234567');
  });

  it('keeps the operator code', () => {
    expect(normalizePkPhone('0345 1234567')).toBe('+923451234567');
    expect(normalizePkPhone('0311-7654321')).toBe('+923117654321');
    expect(normalizePkPhone('3339876543')).toBe('+923339876543');
  });

  it.each([
    ['a Karachi landline without area zero', '0213456789'],
    ['a Karachi landline', '021 34567890'],
    ['a landline in international form', '+922134567890'],
    ['a number not starting with 3 after the prefix', '04001234567'],
    ['too short', '0300123456'],
    ['too short without prefix', '300123456'],
    ['too long', '030012345678'],
    ['too long in international form', '+9230012345678'],
    ['letters', '0300abc4567'],
    ['words', 'my number'],
    ['an extension', '0300 1234567 ext 2'],
    ['a different country', '+44 7700 900123'],
    ['a plus followed by a local number', '+03001234567'],
    ['a plus without the country code', '+3001234567'],
    ['a trunk zero after the country code', '+9203001234567'],
    ['an underscore', '0300_1234567'],
    ['an empty string', ''],
    ['only spaces', '   '],
    ['only a plus', '+'],
    ['only the international prefix', '0092'],
  ])('rejects %s (%j)', (_label, input) => {
    expect(normalizePkPhone(input)).toBeNull();
  });

  it('is idempotent', () => {
    const once = normalizePkPhone('0300-1234567');
    expect(once).not.toBeNull();
    expect(normalizePkPhone(once ?? '')).toBe(once);
  });

  it('always returns +923 followed by 9 digits', () => {
    for (const input of ['03001234567', '3451234567', '00923331234567']) {
      expect(normalizePkPhone(input)).toMatch(/^\+923\d{9}$/);
    }
  });
});

describe('isPkMobile', () => {
  it('agrees with normalizePkPhone', () => {
    expect(isPkMobile('0300 1234567')).toBe(true);
    expect(isPkMobile('021 34567890')).toBe(false);
  });
});

describe('formatPkPhone', () => {
  it('shows a mobile number the way people write it', () => {
    expect(formatPkPhone('+923001234567')).toBe('0300 1234567');
    expect(formatPkPhone('03451234567')).toBe('0345 1234567');
  });

  it('returns anything else unchanged', () => {
    expect(formatPkPhone('021 34567890')).toBe('021 34567890');
    expect(formatPkPhone('')).toBe('');
  });
});

describe('whatsappNumber', () => {
  it('returns digits for wa.me links, or null', () => {
    expect(whatsappNumber('0300 1234567')).toBe('923001234567');
    expect(whatsappNumber('+923001234567')).toBe('923001234567');
    expect(whatsappNumber('021 34567890')).toBeNull();
  });
});
