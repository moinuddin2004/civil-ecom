/** Runs once when the Next.js server starts: fail fast on bad configuration. */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { getServerEnv } = await import('./lib/env');
    getServerEnv();
  }
}
