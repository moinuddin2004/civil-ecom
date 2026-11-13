import { z } from 'zod';

/**
 * Every environment variable the API reads, validated once at startup (CLAUDE.md §36). The app
 * refuses to start with a list of every problem rather than failing later on first use.
 *
 * Zod is used here (not class-validator) because this is internal configuration, not request
 * input, and the schema needs cross-field rules per profile.
 */

/** `NODE_ENV` picks the profile, and with it which `.env.{profile}` file loads on top of `.env` (see `env-files.ts`). */
export const PROFILES = ['development', 'test', 'production'] as const;
export type Profile = (typeof PROFILES)[number];

/**
 * Placeholder secrets (in `.env.test`, and in `.env.production` until you fill it in) start with this
 * prefix. Production refuses to start while any secret still has it.
 */
export const DEV_SECRET_PREFIX = 'dev-only-';

const SECRET_KEYS = ['JWT_CUSTOMER_SECRET', 'JWT_ADMIN_SECRET', 'REVALIDATE_SECRET'] as const;
const R2_KEYS = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_PUBLIC_BUCKET',
  'R2_PRIVATE_BUCKET',
] as const;

const required = (issue: { input?: unknown }) => (issue.input === undefined ? 'is required' : undefined);

const secret = z.string({ error: required }).min(32, 'must be at least 32 characters');

/** An http(s) URL without a trailing slash. */
const baseUrl = z
  .url({ protocol: /^https?$/, error: required })
  .transform((value) => value.replace(/\/+$/, ''));

/** `true`/`false`/`1`/`0` → boolean. */
const flag = z.enum(['true', 'false', '1', '0']).transform((value) => value === 'true' || value === '1');

/** Comma-separated list of origins, e.g. `https://aricon.com.pk,https://www.aricon.com.pk`. */
const originList = z.string().transform((value, ctx) => {
  const origins: string[] = [];
  for (const item of value.split(',').map((part) => part.trim())) {
    if (!item) continue;
    let url: URL | undefined;
    try {
      url = new URL(item);
    } catch {
      url = undefined;
    }
    if (!url || !/^https?:$/.test(url.protocol) || url.origin !== item.replace(/\/$/, '')) {
      ctx.addIssue({ code: 'custom', message: `"${item}" is not an origin like https://example.com` });
      return z.NEVER;
    }
    origins.push(url.origin);
  }
  return origins;
});

const EnvSchema = z
  .object({
    /* Runtime */
    NODE_ENV: z.enum(PROFILES).default('development'),
    HOST: z.string().min(1).default('127.0.0.1'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    /** Swagger UI at /api/docs. Never served in production, whatever this says. */
    API_DOCS_ENABLED: flag.default(true),
    /** Per-IP rate limits (SPEC §7.1). Always on in production; the test profile turns them off
     * except in the suite that tests them. */
    RATE_LIMIT_ENABLED: flag.default(true),

    /* Database (must be a replica set: transactions, SPEC §3.3) */
    MONGODB_URI: z
      .string({ error: required })
      .regex(/^mongodb(\+srv)?:\/\/\S+$/, 'must be a mongodb:// or mongodb+srv:// connection string'),

    /* Auth: separate signing keys so a customer token can never pass the admin guard (SPEC §3.2) */
    JWT_CUSTOMER_SECRET: secret,
    JWT_ADMIN_SECRET: secret,
    /** Access token lifetime. Short, because a stolen access token can't be revoked. */
    JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().min(60).max(3_600).default(900),
    /** Customer refresh token: rolling, like the 30-day customer session in SPEC §3.2. */
    CUSTOMER_REFRESH_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
    /** Staff refresh token: absolute, like the 12-hour admin session in SPEC §3.2. */
    ADMIN_REFRESH_TTL_HOURS: z.coerce.number().int().min(1).max(72).default(12),

    /* URLs */
    APP_URL: baseUrl,
    RFP_CORS_ORIGINS: originList.default([]),
    WEB_INTERNAL_URL: baseUrl.default('http://127.0.0.1:3000'),
    REVALIDATE_SECRET: secret,

    /* File storage (SPEC §3.3, §12) */
    STORAGE_DRIVER: z.enum(['local', 'r2']).default('local'),
    /** `local` driver only: folder for uploaded files (relative to the API's working directory). */
    STORAGE_LOCAL_DIR: z.string().min(1).default('.uploads'),
    R2_ACCOUNT_ID: z.string().optional(),
    R2_ACCESS_KEY_ID: z.string().optional(),
    R2_SECRET_ACCESS_KEY: z.string().optional(),
    R2_PUBLIC_BUCKET: z.string().optional(),
    R2_PRIVATE_BUCKET: z.string().optional(),
    PUBLIC_IMAGE_BASE_URL: baseUrl,

    /* Email (SPEC §11): without SMTP_HOST, emails are logged instead of sent */
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().min(1).max(65_535).optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    MAIL_FROM: z.string().min(3).default('Aricon Shop <no-reply@aricon.com.pk>'),

    /* Seed only */
    ADMIN_EMAIL: z.email().optional(),
    ADMIN_PASSWORD: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    const issue = (key: keyof typeof env, message: string) => ctx.addIssue({ code: 'custom', path: [key], message });

    if (env.JWT_CUSTOMER_SECRET === env.JWT_ADMIN_SECRET) {
      issue('JWT_ADMIN_SECRET', 'must be different from JWT_CUSTOMER_SECRET');
    }

    if (env.STORAGE_DRIVER === 'r2') {
      for (const key of R2_KEYS) {
        if (!env[key]) issue(key, 'is required when STORAGE_DRIVER=r2');
      }
    }

    if (env.NODE_ENV === 'production') {
      if (env.STORAGE_DRIVER !== 'r2') issue('STORAGE_DRIVER', 'must be "r2" in production');
      if (!env.APP_URL.startsWith('https://')) issue('APP_URL', 'must use https in production');
      if (!env.SMTP_HOST) issue('SMTP_HOST', 'is required in production');
      if (!env.SMTP_PORT) issue('SMTP_PORT', 'is required in production');
      if (!env.RATE_LIMIT_ENABLED) issue('RATE_LIMIT_ENABLED', "can't be turned off in production");
      for (const key of SECRET_KEYS) {
        if (env[key].startsWith(DEV_SECRET_PREFIX)) {
          issue(key, 'is still the example value; generate a new random secret (openssl rand -base64 48)');
        }
      }
    }
  });

export type Env = z.output<typeof EnvSchema>;

export class EnvValidationError extends Error {
  override readonly name = 'EnvValidationError';
}

/**
 * Validates configuration. Empty strings count as "not set", so `KEY=` lines behave like missing
 * keys. Throws `EnvValidationError` listing every problem at once. Unknown variables are ignored
 * (the process environment holds plenty of unrelated ones).
 */
export function parseEnv(source: Readonly<Record<string, unknown>>): Env {
  const cleaned = Object.fromEntries(
    Object.entries(source).map(([key, value]) => [key, typeof value === 'string' && !value.trim() ? undefined : value]),
  );
  const result = EnvSchema.safeParse(cleaned);
  if (result.success) return result.data;

  const lines = result.error.issues.map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`);
  throw new EnvValidationError(
    [
      'Invalid API environment configuration:',
      ...lines,
      'See apps/api/.env.example for every variable and what it is for.',
    ].join('\n'),
  );
}
