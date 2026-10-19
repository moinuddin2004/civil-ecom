import { describe, expect, it } from 'vitest';
import { SLUG_MAX, SLUG_PATTERN, escapeRegExp, highlightParts, isValidSlug, slugify } from './text.js';

describe('slugify (SPEC §5 "Slugs")', () => {
  it.each([
    ['Cement & Plaster (50 kg)', 'cement-plaster-50-kg'],
    ['OPC 53 Grade', 'opc-53-grade'],
    ['  --Hello--World--  ', 'hello-world'],
    ['Lucky Cement — OPC', 'lucky-cement-opc'],
    ['Tiles 12×12', 'tiles-12x12'],
    ['Café Crème', 'cafe-creme'],
    ['PVC_Pipe/1.5"', 'pvc-pipe-1-5'],
    ['ALL CAPS', 'all-caps'],
  ])('%j → %j', (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it('returns an empty string when nothing is usable', () => {
    expect(slugify('')).toBe('');
    expect(slugify('!!! ???')).toBe('');
    expect(slugify('سیمنٹ')).toBe('');
  });

  it('caps the length without leaving a trailing dash', () => {
    const slug = slugify('word '.repeat(60));
    expect(slug.length).toBeLessThanOrEqual(SLUG_MAX);
    expect(slug.endsWith('-')).toBe(false);
    expect(slug).toMatch(SLUG_PATTERN);
  });

  it('always produces a valid slug when it produces anything', () => {
    for (const input of ['A  B', 'a--b', '-a-', 'Ünïcödé Tëxt', '50% off!', '1/2" GI pipe', 'x'.repeat(500)]) {
      const slug = slugify(input);
      expect(slug === '' || isValidSlug(slug)).toBe(true);
    }
  });

  it('is idempotent', () => {
    const once = slugify('Cement & Plaster (50 kg)');
    expect(slugify(once)).toBe(once);
  });
});

describe('isValidSlug', () => {
  it('accepts lowercase a-z0-9 words joined by single dashes', () => {
    expect(isValidSlug('cement-50kg')).toBe(true);
    expect(isValidSlug('a')).toBe(true);
    expect(isValidSlug('a'.repeat(SLUG_MAX))).toBe(true);
  });

  it.each(['Cement', 'a--b', '-a', 'a-', 'a b', 'a_b', '', 'ç', 'a'.repeat(SLUG_MAX + 1)])('rejects %j', (value) => {
    expect(isValidSlug(value)).toBe(false);
  });
});

describe('escapeRegExp', () => {
  it('makes every special character literal', () => {
    const special = '.*+?^${}()|[]\\';
    expect(new RegExp(`^${escapeRegExp(special)}$`).test(special)).toBe(true);
  });

  it('stops a search term from acting as a pattern', () => {
    const pattern = new RegExp(escapeRegExp('1.5'), 'i');
    expect(pattern.test('1.5 inch')).toBe(true);
    expect(pattern.test('125 inch')).toBe(false);
    expect(() => new RegExp(escapeRegExp('(50'))).not.toThrow();
  });
});

describe('highlightParts', () => {
  it('splits text around case-insensitive matches', () => {
    expect(highlightParts('Portland Cement', 'cem')).toEqual([
      { text: 'Portland ', match: false },
      { text: 'Cem', match: true },
      { text: 'ent', match: false },
    ]);
  });

  it('marks every match', () => {
    expect(highlightParts('Tile tile', 'TILE').filter((p) => p.match)).toHaveLength(2);
  });

  it('returns the whole text for an empty query and survives regex characters', () => {
    expect(highlightParts('Cement', '  ')).toEqual([{ text: 'Cement', match: false }]);
    expect(highlightParts('Pipe (50 mm)', '(50')).toEqual([
      { text: 'Pipe ', match: false },
      { text: '(50', match: true },
      { text: ' mm)', match: false },
    ]);
  });
});
