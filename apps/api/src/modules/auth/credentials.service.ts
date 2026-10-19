import type { Role } from '@aricon/shared';
import { Injectable } from '@nestjs/common';
import { AppError } from '../../common/errors/app-error.js';
import type { UserLean } from '../../models/user.model.js';
import { UsersRepository } from '../users/users.repository.js';
import { PasswordHasher } from './password-hasher.service.js';

export const INVALID_CREDENTIALS_MESSAGE = "That email/phone and password don't match. Check them and try again.";

function minutesUntil(date: Date, now: Date): number {
  return Math.max(1, Math.ceil((date.getTime() - now.getTime()) / 60_000));
}

/**
 * Password check shared by the customer and staff logins (SPEC §6.11):
 *
 * - Unknown account, or an account of the other kind (staff on the storefront, customer on the admin
 *   login) → the same generic error as a wrong password, after the same bcrypt work, so neither the
 *   message nor the timing reveals which accounts exist.
 * - 5 wrong passwords → locked for 15 minutes (`ACCOUNT_LOCKED`, 423).
 * - Blocked → `ACCOUNT_BLOCKED` (403), only after the right password, so blocked status can't be
 *   probed without it.
 */
@Injectable()
export class CredentialsService {
  constructor(
    private readonly users: UsersRepository,
    private readonly hasher: PasswordHasher,
  ) {}

  async authenticate(
    lookup: { email: string } | { phone: string } | null,
    password: string,
    allowedRoles: readonly Role[],
    now = new Date(),
  ): Promise<UserLean> {
    const user = lookup ? await this.users.findForLogin(lookup) : null;
    if (!user || !allowedRoles.includes(user.role)) {
      await this.hasher.verifyAgainstDummy(password);
      throw AppError.unauthenticated(INVALID_CREDENTIALS_MESSAGE);
    }

    if (user.lockedUntil && user.lockedUntil > now) throw locked(user.lockedUntil, now);

    if (!(await this.hasher.verify(password, user.passwordHash))) {
      const lockedUntil = await this.users.recordFailedLogin(user._id, now);
      if (lockedUntil) throw locked(lockedUntil, now);
      throw AppError.unauthenticated(INVALID_CREDENTIALS_MESSAGE);
    }

    if (user.status === 'blocked') {
      throw new AppError('ACCOUNT_BLOCKED', 'This account has been blocked. Contact us if you think this is a mistake.');
    }

    await this.users.recordSuccessfulLogin(user._id, now);
    const { passwordHash: _passwordHash, ...rest } = user;
    return { ...rest, lastLoginAt: now, failedLogins: 0, lockedUntil: undefined };
  }

  /** For password changes: the current password must be right (no lockout counting here). */
  async verifyCurrentPassword(userId: string, password: string): Promise<void> {
    const user = await this.users.findWithPasswordById(userId);
    if (!user || !(await this.hasher.verify(password, user.passwordHash))) {
      throw AppError.validation('Your current password is not right.', [
        { path: 'currentPassword', message: 'Your current password is not right.' },
      ]);
    }
  }
}

function locked(until: Date, now: Date): AppError {
  const minutes = minutesUntil(until, now);
  return new AppError(
    'ACCOUNT_LOCKED',
    `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}, or reset your password.`,
  );
}
