import { AUTH_COOKIES } from '@aricon/shared';
import { NextResponse, type NextRequest } from 'next/server';
import { contentSecurityPolicy, newNonce } from './lib/content-security-policy';
import { getServerEnv } from './lib/env';
import { imageBaseUrl } from './lib/site';

/**
 * Keeps signed-in visitors signed in across page loads (PROGRESS.md "Backend decisions": JWT).
 *
 * The API's access cookie expires after 15 minutes and the browser drops it; the refresh cookie
 * lives on. Server Components can't set cookies, so before a page renders this proxy swaps the
 * refresh token for a new pair: the new cookies go back to the browser (`Set-Cookie`) **and** into
 * this request's `cookie` header, so `apiServer()` calls during the render are already signed in.
 *
 * Staff pages (`/admin…`) refresh the admin session, every other page the customer session. If the
 * API is unreachable the page simply renders signed out; if the refresh token is dead the API's
 * response clears the cookies.
 *
 * Every page also gets its Content-Security-Policy here, with a fresh nonce: Next.js reads it from
 * the request headers and puts it on its own scripts (SPEC §16).
 */

const REFRESH_TIMEOUT_MS = 5_000;

interface CookiePair {
  name: string;
  value: string;
}

/** `name=value` from a `Set-Cookie` header (attributes are passed to the browser untouched). */
function nameAndValue(setCookie: string): CookiePair | null {
  const pair = setCookie.split(';', 1)[0] ?? '';
  const index = pair.indexOf('=');
  if (index <= 0) return null;
  return { name: pair.slice(0, index).trim(), value: decodeURIComponent(pair.slice(index + 1).trim()) };
}

/** Continues to the page with the CSP (and its nonce) on the request and the response. */
function withCsp(request: NextRequest, isStaffPage: boolean, setCookies: readonly string[] = []): NextResponse {
  const nonce = newNonce();
  const csp = contentSecurityPolicy({
    nonce,
    development: process.env.NODE_ENV === 'development',
    imageOrigin: new URL(imageBaseUrl).origin,
    admin: isStaffPage,
  });
  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  headers.set('Content-Security-Policy', csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set('Content-Security-Policy', csp);
  for (const header of setCookies) response.headers.append('Set-Cookie', header);
  return response;
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const isStaffPage = request.nextUrl.pathname === '/admin' || request.nextUrl.pathname.startsWith('/admin/');
  const names = isStaffPage ? AUTH_COOKIES.admin : AUTH_COOKIES.customer;
  const refreshToken = request.cookies.get(names.refresh)?.value;
  if (!refreshToken || request.cookies.has(names.access)) return withCsp(request, isStaffPage);

  const env = getServerEnv();
  let refreshed: Response;
  try {
    refreshed = await fetch(`${env.INTERNAL_API_URL}/api/${isStaffPage ? 'admin/' : ''}auth/refresh`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Cookie: `${names.refresh}=${encodeURIComponent(refreshToken)}`,
        // The API's Origin check covers every POST, ours included.
        Origin: env.NEXT_PUBLIC_SITE_URL,
        // Rate limits and the session list should see the visitor, not this server.
        ...(request.headers.get('x-forwarded-for') && { 'X-Forwarded-For': request.headers.get('x-forwarded-for') ?? '' }),
        ...(request.headers.get('user-agent') && { 'User-Agent': request.headers.get('user-agent') ?? '' }),
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(REFRESH_TIMEOUT_MS),
    });
  } catch {
    return withCsp(request, isStaffPage);
  }

  const setCookies = refreshed.headers.getSetCookie();
  for (const header of setCookies) {
    const cookie = nameAndValue(header);
    if (!cookie) continue;
    if (cookie.value) request.cookies.set(cookie.name, cookie.value);
    else request.cookies.delete(cookie.name);
  }

  return withCsp(request, isStaffPage, setCookies);
}

export const config = {
  // Pages only: not the API (Nginx/rewrites send it straight to Nest), not static files or images,
  // not the internal revalidation endpoint.
  matcher: ['/((?!api/|_next/static|_next/image|_internal/|favicon\\.ico|.*\\.[a-zA-Z0-9]+$).*)'],
};
