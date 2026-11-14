import { createSign, generateKeyPairSync } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  GoogleIdTokenError,
  verifyGoogleIdToken,
  type GoogleIdentity,
  type GoogleJwk,
} from './google-id-token.js';

const CLIENT_ID = 'test-client.apps.googleusercontent.com';
const NONCE = 'the-sign-in-nonce';
const KID = 'test-key-1';

let privateKey: ReturnType<typeof generateKeyPairSync>['privateKey'];
let keys: GoogleJwk[];

beforeAll(() => {
  const pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
  privateKey = pair.privateKey;
  const jwk = pair.publicKey.export({ format: 'jwk' }) as unknown as GoogleJwk;
  keys = [{ ...jwk, kid: KID, alg: 'RS256', use: 'sig' }];
});

interface Claims {
  iss?: string;
  aud?: string | string[];
  azp?: string;
  exp?: number;
  iat?: number;
  nonce?: string;
  email?: string;
  email_verified?: boolean | string;
  sub?: string;
  name?: string;
  [key: string]: unknown;
}

function token(overrides: Claims = {}, header: Record<string, unknown> = {}): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: Claims = {
    iss: 'https://accounts.google.com',
    aud: CLIENT_ID,
    exp: now + 3_600,
    iat: now,
    nonce: NONCE,
    email: 'Buyer@Example.com',
    email_verified: true,
    sub: 'google-subject',
    name: 'Ayesha Khan',
    ...overrides,
  };
  const encodedHeader = Buffer.from(JSON.stringify({ alg: 'RS256', kid: KID, typ: 'JWT', ...header })).toString(
    'base64url',
  );
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createSign('RSA-SHA256')
    .update(`${encodedHeader}.${encodedPayload}`)
    .sign(privateKey)
    .toString('base64url');
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function verify(idToken: string): GoogleIdentity {
  return verifyGoogleIdToken({ idToken, keys, clientId: CLIENT_ID, nonce: NONCE });
}

function codeOf(idToken: string): string {
  try {
    verify(idToken);
  } catch (error) {
    if (error instanceof GoogleIdTokenError) return error.code;
    throw error;
  }
  throw new Error('expected verification to fail');
}

describe('verifyGoogleIdToken', () => {
  it('returns the verified identity and normalizes the email', () => {
    expect(verify(token())).toEqual({
      subject: 'google-subject',
      email: 'buyer@example.com',
      name: 'Ayesha Khan',
      emailVerified: true,
    });
  });

  it('accepts the bare accounts.google.com issuer too', () => {
    expect(verify(token({ iss: 'accounts.google.com' })).email).toBe('buyer@example.com');
  });

  it('rejects a token signed with another key', () => {
    const other = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const encodedHeader = Buffer.from(JSON.stringify({ alg: 'RS256', kid: KID })).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify({ nonce: NONCE })).toString('base64url');
    const signature = createSign('RSA-SHA256')
      .update(`${encodedHeader}.${encodedPayload}`)
      .sign(other.privateKey)
      .toString('base64url');
    expect(codeOf(`${encodedHeader}.${encodedPayload}.${signature}`)).toBe('bad_signature');
  });

  it('rejects an unknown signing key', () => {
    expect(codeOf(token({}, { kid: 'another-key' }))).toBe('bad_signature');
  });

  it('rejects a wrong issuer, audience and authorized party', () => {
    expect(codeOf(token({ iss: 'https://evil.example.com' }))).toBe('bad_issuer');
    expect(codeOf(token({ aud: 'another-client' }))).toBe('bad_audience');
    expect(codeOf(token({ aud: [CLIENT_ID], azp: 'another-client' }))).toBe('bad_audience');
  });

  it('rejects an expired token and one issued in the future', () => {
    const now = Math.floor(Date.now() / 1000);
    expect(codeOf(token({ exp: now - 120, iat: now - 3_600 }))).toBe('expired');
    expect(codeOf(token({ iat: now + 300 }))).toBe('malformed');
  });

  it('rejects a token from a different sign-in attempt', () => {
    expect(codeOf(token({ nonce: 'another-nonce' }))).toBe('bad_nonce');
    expect(codeOf(token({ nonce: undefined }))).toBe('bad_nonce');
  });

  it('rejects an email Google has not verified', () => {
    expect(codeOf(token({ email_verified: false }))).toBe('email_unverified');
    expect(codeOf(token({ email_verified: undefined }))).toBe('email_unverified');
  });

  it('rejects malformed tokens and unusable claims', () => {
    expect(codeOf('not-a-jwt')).toBe('malformed');
    expect(codeOf(token({}, { alg: 'HS256' }))).toBe('malformed');
    expect(codeOf(token({ email: 'not-an-email' }))).toBe('malformed');
    expect(codeOf(token({ sub: undefined }))).toBe('malformed');
  });
});
