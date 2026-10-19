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
  it('orders files from most to least specific', () => {
    expect(envFilesFor('development', '/app')).toEqual(
      ['.env.development.local', '.env.development', '.env.local', '.env'].map((file) => join('/app', file)),
    );
  });

  it('skips .env.local in tests so they run the same on every machine', () => {
    expect(envFilesFor('test', '/app')).toEqual(['.env.test.local', '.env.test', '.env'].map((file) => join('/app', file)));
  });
});
