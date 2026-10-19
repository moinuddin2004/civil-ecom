import { PASSWORD_RESET_TTL_MINUTES } from '@aricon/shared';
import { Injectable } from '@nestjs/common';
import { AppError } from '../../common/errors/app-error.js';
import { AppConfig } from '../../config/app-config.service.js';
import { TransactionService } from '../../database/transaction.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { UsersRepository } from '../users/users.repository.js';
import { AuthUserCache } from './auth-user-cache.service.js';
import { hashToken, PasswordHasher, randomToken } from './password-hasher.service.js';
import { PasswordResetRepository } from './password-reset.repository.js';
import { TokenService } from './token.service.js';

/**
 * "Forgot password" for customers (SPEC §6.11). Staff passwords are reset by an admin instead.
 * The reply never says whether the email is registered; the link is valid for 60 minutes, works
 * once, and using it signs the customer out everywhere.
 */
@Injectable()
export class PasswordResetService {
  constructor(
    private readonly users: UsersRepository,
    private readonly resets: PasswordResetRepository,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenService,
    private readonly cache: AuthUserCache,
    private readonly transactions: TransactionService,
    private readonly notifications: NotificationsService,
    private readonly config: AppConfig,
  ) {}

  /** Always resolves: whether an email was sent is never revealed. */
  async requestReset(email: string, now = new Date()): Promise<void> {
    const user = await this.users.findOne({ email, role: 'CUSTOMER' });
    if (!user || user.status !== 'active') return;

    const token = randomToken();
    await this.resets.invalidateOpen(user._id, now);
    await this.resets.create(user._id, hashToken(token), new Date(now.getTime() + PASSWORD_RESET_TTL_MINUTES * 60_000));

    const resetUrl = `${this.config.get('APP_URL')}/reset-password?token=${encodeURIComponent(token)}`;
    await this.notifications.notify('auth.password_reset', {
      to: user.email,
      name: user.name,
      resetUrl,
      expiresInMinutes: PASSWORD_RESET_TTL_MINUTES,
    });
  }

  async resetPassword(token: string, password: string, now = new Date()): Promise<void> {
    const passwordHash = await this.hasher.hash(password);

    const userId = await this.transactions.run(async (session) => {
      const reset = await this.resets.consume(hashToken(token), now, session);
      if (!reset) {
        throw AppError.validation('This reset link is not valid or has expired. Request a new one.', [
          { path: 'token', message: 'This reset link is not valid or has expired.' },
        ]);
      }
      await this.users.setPassword(reset.userId, passwordHash, session);
      await this.resets.invalidateOpen(reset.userId, now, session);
      return String(reset.userId);
    });

    await this.tokens.revokeAllForUser(userId, 'password_changed');
    this.cache.invalidate(userId);
  }
}
