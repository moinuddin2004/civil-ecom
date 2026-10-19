import { revalidateTag } from 'next/cache';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { getServerEnv } from '@/lib/env';

/**
 * `POST /_internal/revalidate` (SPEC §3.1, §14): the API calls this after catalog, homepage,
 * settings or stock changes with the `CACHE_TAGS` it touched. The folder is named `%5Finternal`
 * because `_`-prefixed folders are private in the App Router; it is served at `/_internal/...`.
 *
 * Only for the API on the same server: it needs `x-revalidate-secret`, and Nginx must block
 * `/_internal` from the internet (SPEC §3.1).
 */

/** The tag shapes `CACHE_TAGS` produces; anything else is refused. */
const TAG = /^(catalog|home|pages|settings|delivery-areas|(product|category|brand):[a-z0-9]+(-[a-z0-9]+)*)$/;

const bodySchema = z.strictObject({
  tags: z.array(z.string().max(140).regex(TAG)).min(1).max(500),
});

function sameSecret(given: string | null, expected: string): boolean {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request): Promise<Response> {
  if (!sameSecret(request.headers.get('x-revalidate-secret'), getServerEnv().REVALIDATE_SECRET)) {
    return new Response(null, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Body must be JSON: { "tags": [...] }' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: 'Send { "tags": [...] } with known cache tags.' }, { status: 400 });

  // Expire now rather than serve stale-while-revalidate: a changed price must not be shown again.
  for (const tag of new Set(parsed.data.tags)) revalidateTag(tag, { expire: 0 });
  return new Response(null, { status: 204 });
}
