/**
 * Content-Security-Policy for pages (SPEC §16): scripts only from this site and with this
 * request's nonce (Next.js adds it to its own scripts), images from this site and the image
 * domain, fonts self-hosted by next/font, no plugins, no being framed by other sites (and not at
 * all for `/admin`).
 */
export interface CspOptions {
  nonce: string;
  /** `next dev` needs eval (React Refresh) and its HMR websocket. */
  development: boolean;
  /** Origin of public images, e.g. `https://images.aricon.com.pk`. */
  imageOrigin: string;
  /** Admin pages may never be framed. */
  admin: boolean;
}

export function contentSecurityPolicy({ nonce, development, imageOrigin, admin }: CspOptions): string {
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(development ? ["'unsafe-eval'"] : [])],
    // Inline style attributes (charts, next/font variables) are harmless without script.
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:', imageOrigin],
    'font-src': ["'self'", 'data:'],
    'connect-src': ["'self'", ...(development ? ['ws:', 'wss:'] : [])],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': [admin ? "'none'" : "'self'"],
  };
  const policy = Object.entries(directives).map(([name, values]) => `${name} ${[...new Set(values)].join(' ')}`);
  if (!development) policy.push('upgrade-insecure-requests');
  return policy.join('; ');
}

/** A fresh nonce per request (128 random bits, base64). */
export function newNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}
