import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { activeProfile, envFilesFor } from './env-files.js';

describe('activeProfile', () => {
  it('defaults to development when NODE_ENV is empty', () => {
    expect(activeProfile('')).toBe('development');
    expect(activeProfile('  ')).toBe('development');
  });

  it('refuses an unknown profile instead of falling back silently', () => {
    expect(() => activeProfile('prod')).toThrow('NODE_ENV must be one of development, test, production');
  });
});

describe('envFilesFor', () => {
  it('reads the profile file first, then the common .env', () => {
    expect(envFilesFor('development', '/app')).toEqual(['.env.development', '.env'].map((file) => join('/app', file)));
    expect(envFilesFor('production', '/app')).toEqual(['.env.production', '.env'].map((file) => join('/app', file)));
  });

  it('reads only .env.test in tests so they run the same on every machine', () => {
    expect(envFilesFor('test', '/app')).toEqual([join('/app', '.env.test')]);
  });
});
