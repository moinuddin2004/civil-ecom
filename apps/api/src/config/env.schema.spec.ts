import { describe, expect, it } from 'vitest';
import { EnvValidationError, parseEnv } from './env.schema.js';

const DEV = {
  MONGODB_URI: 'mongodb://127.0.0.1:27017/aricon?replicaSet=rs0',
  JWT_CUSTOMER_SECRET: 'dev-only-jwt-customer-secret-0123456789abcdef',
  JWT_ADMIN_SECRET: 'dev-only-jwt-admin-secret-0123456789abcdefghij',
  APP_URL: 'http://localhost:3000/',
  REVALIDATE_SECRET: 'dev-only-revalidate-secret-0123456789abcdef',
  PUBLIC_IMAGE_BASE_URL: 'http://localhost:3000/api/dev-files',
};

const PROD = {
  ...DEV,
  NODE_ENV: 'production',
  JWT_CUSTOMER_SECRET: 'x'.repeat(40),
  JWT_ADMIN_SECRET: 'y'.repeat(40),
  REVALIDATE_SECRET: 'z'.repeat(40),
  APP_URL: 'https://shop.aricon.com.pk',
  GOOGLE_CLIENT_ID: 'prod-google-client-id.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'prod-google-client-secret-value',
  GOOGLE_CALLBACK_URL: 'https://shop.aricon.com.pk/api/auth/google/callback',
  STORAGE_DRIVER: 'r2',
  R2_ACCOUNT_ID: 'a',
  R2_ACCESS_KEY_ID: 'b',
  R2_SECRET_ACCESS_KEY: 'c',
  R2_PUBLIC_BUCKET: 'aricon-public',
  R2_PRIVATE_BUCKET: 'aricon-private',
  SMTP_HOST: 'smtp.example.com',
  SMTP_PORT: '587',
};

function problems(source: Record<string, string>): string {
  try {
    parseEnv(source);
  } catch (error) {
    if (error instanceof EnvValidationError) return error.message;
    throw error;
  }
  throw new Error('expected parseEnv to fail');
}

describe('parseEnv', () => {
  it('applies defaults and normalizes URLs for a minimal development config', () => {
    const env = parseEnv(DEV);
    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(4000);
    expect(env.HOST).toBe('127.0.0.1');
    expect(env.JWT_ACCESS_TTL_SECONDS).toBe(900);
    expect(env.APP_URL).toBe('http://localhost:3000');
    expect(env.API_DOCS_ENABLED).toBe(true);
  });

  it('treats empty strings as not set and lists every problem at once', () => {
    const message = problems({ ...DEV, MONGODB_URI: '', JWT_ADMIN_SECRET: '  ' });
    expect(message).toContain('MONGODB_URI: is required');
    expect(message).toContain('JWT_ADMIN_SECRET: is required');
  });

  it('rejects short secrets and the same secret for customers and staff', () => {
    expect(problems({ ...DEV, JWT_CUSTOMER_SECRET: 'short' })).toContain('at least 32 characters');
    expect(problems({ ...DEV, JWT_ADMIN_SECRET: DEV.JWT_CUSTOMER_SECRET })).toContain(
      'must be different from JWT_CUSTOMER_SECRET',
    );
  });

  it('parses comma-separated origins and rejects anything that is not an origin', () => {
    expect(parseEnv({ ...DEV, RFP_CORS_ORIGINS: 'https://a.com, https://www.a.com' }).RFP_CORS_ORIGINS).toEqual([
      'https://a.com',
      'https://www.a.com',
    ]);
    expect(problems({ ...DEV, RFP_CORS_ORIGINS: 'https://a.com/path' })).toContain('is not an origin');
  });

  it('accepts a complete production config', () => {
    expect(parseEnv(PROD).NODE_ENV).toBe('production');
  });

  it('refuses to run production with development settings', () => {
    const message = problems({
      ...PROD,
      JWT_CUSTOMER_SECRET: DEV.JWT_CUSTOMER_SECRET,
      APP_URL: 'http://shop.aricon.com.pk',
      STORAGE_DRIVER: 'local',
      SMTP_HOST: '',
    });
    expect(message).toContain('JWT_CUSTOMER_SECRET: is still the example value');
    expect(message).toContain('APP_URL: must use https in production');
    expect(message).toContain('STORAGE_DRIVER: must be "r2" in production');
    expect(message).toContain('SMTP_HOST: is required in production');
  });

  it('requires the R2 credentials when the r2 driver is chosen', () => {
    expect(problems({ ...DEV, STORAGE_DRIVER: 'r2' })).toContain('R2_ACCOUNT_ID: is required when STORAGE_DRIVER=r2');
  });

  it('accepts Google sign-in only as a complete set', () => {
    expect(
      parseEnv({
        ...DEV,
        GOOGLE_CLIENT_ID: 'dev-client-id.apps.googleusercontent.com',
        GOOGLE_CLIENT_SECRET: 'dev-client-secret',
        GOOGLE_CALLBACK_URL: 'http://localhost:3000/api/auth/google/callback',
      }).GOOGLE_CLIENT_ID,
    ).toBe('dev-client-id.apps.googleusercontent.com');

    const message = problems({ ...DEV, GOOGLE_CLIENT_ID: 'dev-client-id.apps.googleusercontent.com' });
    expect(message).toContain('GOOGLE_CLIENT_SECRET: is required when Google sign-in is configured');
    expect(message).toContain('GOOGLE_CALLBACK_URL: is required when Google sign-in is configured');
  });

  it('keeps the Google callback on the same site as APP_URL', () => {
    const message = problems({
      ...DEV,
      GOOGLE_CLIENT_ID: 'dev-client-id.apps.googleusercontent.com',
      GOOGLE_CLIENT_SECRET: 'dev-client-secret',
      GOOGLE_CALLBACK_URL: 'http://127.0.0.1:4000/api/auth/google/callback',
    });
    expect(message).toContain('must be on the same site as APP_URL');
  });

  it('requires Google sign-in in production', () => {
    const message = problems({
      ...PROD,
      GOOGLE_CLIENT_ID: '',
      GOOGLE_CLIENT_SECRET: '',
      GOOGLE_CALLBACK_URL: '',
    });
    expect(message).toContain('GOOGLE_CLIENT_ID: is required in production');
    expect(message).toContain('GOOGLE_CLIENT_SECRET: is required in production');
    expect(message).toContain('GOOGLE_CALLBACK_URL: is required in production');
  });
});
