import { Injectable } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes, randomInt } from 'node:crypto';

/** bcrypt cost from SPEC §5.1. */
const BCRYPT_COST = 12;

/** No 0/O, 1/l/I: temporary passwords are read aloud or typed from a screen (SPEC §7.3). */
const TEMP_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

/** SHA-256 hex of a random token; only the hash is ever stored (refresh tokens, reset links). */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** 32 random bytes as base64url (43 characters). */
export function randomToken(): string {
  return randomBytes(32).toString('base64url');
}

/** The equivalent of Spring Security's `PasswordEncoder`. */
@Injectable()
export class PasswordHasher {
  private dummyHash: Promise<string> | undefined;

  hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, BCRYPT_COST);
  }

  verify(plain: string, passwordHash: string): Promise<boolean> {
    return bcrypt.compare(plain, passwordHash);
  }

  /**
   * Spends the same bcrypt time as a real check when the account doesn't exist, so response times
   * don't reveal which emails or phones are registered. Always resolves to false.
   */
  async verifyAgainstDummy(plain: string): Promise<false> {
    this.dummyHash ??= bcrypt.hash('aricon-timing-equaliser', BCRYPT_COST);
    await bcrypt.compare(plain, await this.dummyHash);
    return false;
  }

  /**
   * 12 random characters without ambiguous ones, always with a letter and a digit so it satisfies
   * the password rules. Shown once in the admin UI; never emailed or logged (SPEC §7.3).
   */
  temporaryPassword(length = 12): string {
    for (;;) {
      let value = '';
      for (let i = 0; i < length; i++) value += TEMP_ALPHABET[randomInt(TEMP_ALPHABET.length)];
      if (/[A-Za-z]/.test(value) && /\d/.test(value)) return value;
    }
  }
}
