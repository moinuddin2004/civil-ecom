import { Injectable, Logger } from '@nestjs/common';
import { AppConfig } from '../../../config/app-config.service.js';
import {
  GoogleIdTokenError,
  verifyGoogleIdToken,
  type GoogleIdentity,
  type GoogleJwk,
} from './google-id-token.js';

const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const HTTP_TIMEOUT_MS = 10_000;
const DEFAULT_JWKS_TTL_MS = 60 * 60_000;

export class GoogleSignInUnavailableError extends Error {
  override readonly name = 'GoogleSignInUnavailableError';
}

/**
 * Talks to Google: builds the authorization URL, exchanges the one-time code, then verifies the ID
 * token against Google's published keys. No OAuth package; Node's `fetch` and `crypto` are enough.
 */
@Injectable()
export class GoogleIdentityService {
  private readonly logger = new Logger(GoogleIdentityService.name);
  private keys: GoogleJwk[] = [];
  private keysExpireAt = 0;

  constructor(private readonly config: AppConfig) {}

  get configured(): boolean {
    return Boolean(
      this.config.get('GOOGLE_CLIENT_ID') &&
        this.config.get('GOOGLE_CLIENT_SECRET') &&
        this.config.get('GOOGLE_CALLBACK_URL'),
    );
  }

  authorizationUrl(input: { state: string; codeChallenge: string; nonce: string }): string {
    const params = new URLSearchParams({
      client_id: this.clientId(),
      redirect_uri: this.callbackUrl(),
      response_type: 'code',
      scope: 'openid email profile',
      state: input.state,
      nonce: input.nonce,
      code_challenge: input.codeChallenge,
      code_challenge_method: 'S256',
      access_type: 'online',
      prompt: 'select_account',
    });
    return `${AUTHORIZE_URL}?${params.toString()}`;
  }

  /** Exchanges the code and returns only claims that passed signature, audience, nonce and expiry checks. */
  async exchangeCode(code: string, codeVerifier: string, nonce: string): Promise<GoogleIdentity> {
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({
        code,
        client_id: this.clientId(),
        client_secret: this.clientSecret(),
        redirect_uri: this.callbackUrl(),
        grant_type: 'authorization_code',
        code_verifier: codeVerifier,
      }),
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
    });

    if (!response.ok) {
      // Never log Google's body: it can echo request data.
      this.logger.warn({ status: response.status }, 'Google token exchange failed');
      throw new Error('Google token exchange failed.');
    }

    const body = (await response.json()) as { id_token?: unknown };
    if (typeof body.id_token !== 'string') {
      throw new Error('Google did not return an ID token.');
    }

    try {
      return verifyGoogleIdToken({
        idToken: body.id_token,
        keys: await this.signingKeys(false),
        clientId: this.clientId(),
        nonce,
      });
    } catch (error) {
      if (error instanceof GoogleIdTokenError && error.code === 'bad_signature') {
        // Google rotates keys; one forced refresh handles a key published after our last fetch.
        return verifyGoogleIdToken({
          idToken: body.id_token,
          keys: await this.signingKeys(true),
          clientId: this.clientId(),
          nonce,
        });
      }
      throw error;
    }
  }

  private async signingKeys(forceRefresh: boolean): Promise<GoogleJwk[]> {
    if (!forceRefresh && this.keys.length > 0 && Date.now() < this.keysExpireAt) {
      return this.keys;
    }

    const response = await fetch(JWKS_URL, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
    });
    if (!response.ok) {
      this.logger.warn({ status: response.status }, 'Google signing keys could not be loaded');
      throw new Error('Google signing keys could not be loaded.');
    }

    const body = (await response.json()) as { keys?: unknown };
    if (!Array.isArray(body.keys)) throw new Error('Google signing keys are malformed.');
    const keys = body.keys.filter(isGoogleJwk);
    if (keys.length === 0) throw new Error('Google returned no signing keys.');

    this.keys = keys;
    this.keysExpireAt = Date.now() + cacheLifetimeMs(response.headers.get('cache-control'));
    return keys;
  }

  private clientId(): string {
    return this.require('GOOGLE_CLIENT_ID');
  }

  private clientSecret(): string {
    return this.require('GOOGLE_CLIENT_SECRET');
  }

  private callbackUrl(): string {
    return this.require('GOOGLE_CALLBACK_URL');
  }

  private require(key: 'GOOGLE_CLIENT_ID' | 'GOOGLE_CLIENT_SECRET' | 'GOOGLE_CALLBACK_URL'): string {
    const value = this.config.get(key);
    if (!value) throw new GoogleSignInUnavailableError('Google sign-in is not configured.');
    return value;
  }
}

function isGoogleJwk(value: unknown): value is GoogleJwk {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.kty === 'RSA' &&
    typeof candidate.kid === 'string' &&
    typeof candidate.n === 'string' &&
    typeof candidate.e === 'string'
  );
}

function cacheLifetimeMs(cacheControl: string | null): number {
  const match = cacheControl ? /(?:^|,)\s*max-age=(\d+)/i.exec(cacheControl) : null;
  const seconds = match ? Number(match[1]) : 0;
  return seconds > 0 ? Math.min(seconds * 1000, DEFAULT_JWKS_TTL_MS) : DEFAULT_JWKS_TTL_MS;
}
