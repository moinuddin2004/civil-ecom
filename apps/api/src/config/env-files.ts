import { join } from 'node:path';
import { PROFILES, type Profile } from './env.schema.js';

/**
 * The active profile, from `NODE_ENV` (default `development`). An unknown value is a startup error
 * rather than a silent fall-back, so a typo can't run production with development settings.
 */
export function activeProfile(nodeEnv: string | undefined = process.env.NODE_ENV): Profile {
  const profile = nodeEnv?.trim() || 'development';
  if (!(PROFILES as readonly string[]).includes(profile)) {
    throw new Error(`NODE_ENV must be one of ${PROFILES.join(', ')} (got "${profile}").`);
  }
  return profile as Profile;
}

/**
 * Env files for a profile, highest priority first (the first file that sets a key wins, and real
 * environment variables set on the machine beat every file):
 *
 * 1. `.env.{profile}` — values of that profile only (`.env.development` or `.env.production`)
 * 2. `.env`           — values common to development and production
 *
 * Tests read only `.env.test`, so they run the same on every machine and never pick up real
 * settings (a real SMTP server, a real database) from `.env`.
 */
export function envFilesFor(profile: Profile, cwd: string = process.cwd()): string[] {
  const files = profile === 'test' ? ['.env.test'] : [`.env.${profile}`, '.env'];
  return files.map((file) => join(cwd, file));
}
