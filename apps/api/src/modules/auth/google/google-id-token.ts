import { createHash, createPublicKey, timingSafeEqual, verify } from 'node:crypto';

/** The public part of a Google signing key (JWKS). */
export interface GoogleJwk {
  kty: string;
  kid: string;
  n: string;
  e: string;
  alg?: string;
  use?: string;
  [key: string]: unknown;
}

/** What the rest of the app needs from a Google ID token. */
export interface GoogleIdentity {
  subject: string;
  email: string;
  name: string | null;
  emailVerified: true;
}

export type GoogleIdTokenErrorCode =
  | 'malformed'
  | 'bad_signature'
  | 'bad_issuer'
  | 'bad_audience'
  | 'expired'
  | 'bad_nonce'
  | 'email_unverified';

export class GoogleIdTokenError extends Error {
  override readonly name = 'GoogleIdTokenError';

  constructor(readonly code: GoogleIdTokenErrorCode, message: string) {
    super(message);
  }
}

const GOOGLE_ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);
const CLOCK_SKEW_SECONDS = 60;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface VerifyOptions {
  idToken: string;
  keys: readonly GoogleJwk[];
  clientId: string;
  nonce: string;
  now?: Date;
}

/**
 * Verifies a Google ID token without an OAuth library: RS256 signature against the published
 * JWKS, then issuer, audience, expiry, nonce and `email_verified`. This is the security boundary of
 * Google sign-in; the OAuth code exchange only proves which token to check.
 */
export function verifyGoogleIdToken(options: VerifyOptions): GoogleIdentity {
  const { idToken, keys, clientId, nonce } = options;
  const now = options.now ?? new Date();
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new GoogleIdTokenError('malformed', 'Not a JWT.');
  const [encodedHeader = '', encodedPayload = '', encodedSignature = ''] = parts;

  const header = decodeObject(encodedHeader);
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') {
    throw new GoogleIdTokenError('malformed', 'Unexpected token header.');
  }

  const jwk = keys.find((key) => key.kid === header.kid);
  if (!jwk) throw new GoogleIdTokenError('bad_signature', 'Unknown signing key.');

  const publicKey = createPublicKey({ key: jwk, format: 'jwk' });
  const signed = Buffer.from(`${encodedHeader}.${encodedPayload}`);
  const signature = Buffer.from(encodedSignature, 'base64url');
  if (!verify('RSA-SHA256', signed, publicKey, signature)) {
    throw new GoogleIdTokenError('bad_signature', 'Signature does not match.');
  }

  const payload = decodeObject(encodedPayload);
  if (typeof payload.iss !== 'string' || !GOOGLE_ISSUERS.has(payload.iss)) {
    throw new GoogleIdTokenError('bad_issuer', 'Unexpected issuer.');
  }

  const audiences = Array.isArray(payload.aud)
    ? payload.aud.filter((value): value is string => typeof value === 'string')
    : typeof payload.aud === 'string'
      ? [payload.aud]
      : [];
  if (!audiences.includes(clientId)) {
    throw new GoogleIdTokenError('bad_audience', 'Token was issued for another app.');
  }
  if (Array.isArray(payload.aud) && payload.azp !== clientId) {
    throw new GoogleIdTokenError('bad_audience', 'Token was issued to another party.');
  }

  const nowSeconds = Math.floor(now.getTime() / 1000);
  if (typeof payload.exp !== 'number' || payload.exp <= nowSeconds - CLOCK_SKEW_SECONDS) {
    throw new GoogleIdTokenError('expired', 'Token has expired.');
  }
  if (typeof payload.iat !== 'number' || payload.iat > nowSeconds + CLOCK_SKEW_SECONDS) {
    throw new GoogleIdTokenError('malformed', 'Token was issued in the future.');
  }

  if (typeof payload.nonce !== 'string' || !safeEqual(payload.nonce, nonce)) {
    throw new GoogleIdTokenError('bad_nonce', 'Sign-in request does not match.');
  }

  if (payload.email_verified !== true && payload.email_verified !== 'true') {
    throw new GoogleIdTokenError('email_unverified', 'Google has not verified this email address.');
  }
  if (
    typeof payload.email !== 'string' ||
    payload.email.length > 254 ||
    !EMAIL_PATTERN.test(payload.email)
  ) {
    throw new GoogleIdTokenError('malformed', 'Token has no usable email address.');
  }
  if (typeof payload.sub !== 'string' || !payload.sub) {
    throw new GoogleIdTokenError('malformed', 'Token has no subject.');
  }

  return {
    subject: payload.sub,
    email: payload.email.trim().toLowerCase(),
    name: typeof payload.name === 'string' ? payload.name.trim().slice(0, 80) || null : null,
    emailVerified: true,
  };
}

function decodeObject(part: string): Record<string, unknown> {
  try {
    const value = JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as unknown;
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error('not an object');
    }
    return value as Record<string, unknown>;
  } catch {
    throw new GoogleIdTokenError('malformed', 'Token is not readable.');
  }
}

/** Constant-time comparison for the nonce. */
function safeEqual(actual: string, expected: string): boolean {
  const a = createHash('sha256').update(actual).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}
