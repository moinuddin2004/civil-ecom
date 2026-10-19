import { describe, expect, it } from 'vitest';
import { ERROR_CODES, ERROR_STATUS, isErrorCode } from './errors.js';

describe('error codes', () => {
  it('maps every code from SPEC §7.1 to its HTTP status', () => {
    expect(ERROR_STATUS).toEqual({
      VALIDATION_ERROR: 400,
      UNAUTHENTICATED: 401,
      FORBIDDEN: 403,
      ACCOUNT_BLOCKED: 403,
      NOT_FOUND: 404,
      CONFLICT: 409,
      EMAIL_TAKEN: 409,
      PHONE_TAKEN: 409,
      OUT_OF_STOCK: 409,
      PRICE_CHANGED: 409,
      INVALID_TRANSITION: 409,
      PAYLOAD_TOO_LARGE: 413,
      UNSUPPORTED_FILE: 415,
      ACCOUNT_LOCKED: 423,
      RATE_LIMITED: 429,
      INTERNAL: 500,
    });
    expect(ERROR_CODES).toHaveLength(16);
  });

  it('recognises known codes only', () => {
    expect(isErrorCode('PRICE_CHANGED')).toBe(true);
    expect(isErrorCode('price_changed')).toBe(false);
    expect(isErrorCode('toString')).toBe(false);
    expect(isErrorCode(409)).toBe(false);
  });
});
