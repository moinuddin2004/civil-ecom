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
 * environment variables beat every file) — the same layering as Spring's `application-{profile}`:
 *
 * 1. `.env.{profile}.local` — your machine only (git-ignored)
 * 2. `.env.{profile}`       — committed defaults for that profile (no real secrets)
 * 3. `.env.local`           — your machine, every profile except test (git-ignored)
 * 4. `.env`                 — your machine, shared fallback (git-ignored)
 *
 * Tests skip `.env.local` so they are reproducible on every machine. Production loads no file from
 * the repo: the server provides real values through its own environment (SPEC §18).
 */
export function envFilesFor(profile: Profile, cwd: string = process.cwd()): string[] {
  const files = [`.env.${profile}.local`, `.env.${profile}`];
  if (profile !== 'test') files.push('.env.local');
  files.push('.env');
  return files.map((file) => join(cwd, file));
}
