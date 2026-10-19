import { z } from 'zod';

const DEV_SECRET_PREFIX = 'dev-only-';

const baseUrl = z
  .url({ protocol: /^https?$/ })
  .transform((value) => value.replace(/\/+$/, ''));

const ServerEnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    INTERNAL_API_URL: baseUrl,
    REVALIDATE_SECRET: z.string().min(32, 'must be at least 32 characters'),
    NEXT_PUBLIC_SITE_URL: baseUrl,
    NEXT_PUBLIC_IMAGE_BASE_URL: baseUrl,
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && env.REVALIDATE_SECRET.startsWith(DEV_SECRET_PREFIX)) {
      ctx.addIssue({
        code: 'custom',
        path: ['REVALIDATE_SECRET'],
        message: 'is still the example value; use the same new secret as the API',
      });
    }
  });

export type ServerEnv = z.output<typeof ServerEnvSchema>;

let cached: ServerEnv | undefined;

/**
 * Server-side configuration, validated once. Call only from server code: it includes secrets.
 * Throws with a list of every problem so a misconfigured server fails at startup.
 */
export function getServerEnv(): ServerEnv {
  if (cached) return cached;
  const result = ServerEnvSchema.safeParse({
    NODE_ENV: process.env.NODE_ENV,
    INTERNAL_API_URL: process.env.INTERNAL_API_URL,
    REVALIDATE_SECRET: process.env.REVALIDATE_SECRET,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_IMAGE_BASE_URL: process.env.NEXT_PUBLIC_IMAGE_BASE_URL,
  });
  if (!result.success) {
    const lines = result.error.issues.map(
      (issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`,
    );
    throw new Error(
      [
        'Invalid web environment configuration:',
        ...lines,
        'See apps/web/.env.example for every variable and what it is for.',
      ].join('\n'),
    );
  }
  cached = result.data;
  return cached;
}
