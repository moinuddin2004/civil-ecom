import { Injectable, Logger } from '@nestjs/common';
import { AppError } from '../../common/errors/app-error.js';
import { AppConfig } from '../../config/app-config.service.js';
import { TransactionService } from '../../database/transaction.service.js';
import type { UserLean } from '../../models/user.model.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { UsersRepository } from '../users/users.repository.js';
import { AuthUserCache } from './auth-user-cache.service.js';
import { EmailVerificationRepository } from './email-verification.repository.js';
import { hashToken, randomToken } from './password-hasher.service.js';
import { TokenService } from './token.service.js';

/** A second request within this window reuses the email already sent (stops resend abuse). */
const RESEND_COOLDOWN_MS = 60_000;

const BAD_LINK =
  'This verification link is not valid or has expired. Request a new one from the login page.';

/**
 * Shared email verification for customers and staff (SPEC §6.11). A link carries 32 random bytes;
 * only its SHA-256 is stored, it works once, and it expires after an hour. Requesting a new link
 * invalidates every open one for that account.
 */
@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);

  constructor(
    private readonly users: UsersRepository,
    private readonly tokens: EmailVerificationRepository,
    private readonly notifications: NotificationsService,
    private readonly transactions: TransactionService,
    private readonly cache: AuthUserCache,
    private readonly config: AppConfig,
    private readonly sessions: TokenService,
  ) {}

  /**
   * Sends a verification link if the account still needs one. Never throws: an email problem must
   * not fail the signup or staff-creation request that triggered it.
   */
  async send(user: Pick<UserLean, '_id' | 'name' | 'email' | 'emailVerified'>, options: { force?: boolean } = {}, now = new Date()): Promise<void> {
    if (user.emailVerified !== false) return;

    try {
      if (!options.force) {
        const latest = await this.tokens.latestCreatedAt(user._id);
        if (latest && now.getTime() - latest.getTime() < RESEND_COOLDOWN_MS) return;
      }

      const token = randomToken();
      const ttlMinutes = this.config.get('EMAIL_VERIFICATION_TOKEN_EXPIRES_MINUTES');
      await this.tokens.invalidateOpen(user._id, now);
      await this.tokens.create(
        user._id,
        hashToken(token),
        new Date(now.getTime() + ttlMinutes * 60_000),
      );

      await this.notifications.notify('auth.verify_email', {
        to: user.email,
        name: user.name,
        verifyUrl: this.verificationUrl(token),
        expiresInMinutes: ttlMinutes,
      });
    } catch (error) {
      // No token or payload in the log.
      this.logger.error({ err: error }, 'Verification email could not be prepared');
    }
  }

  /** Always resolves: whether the address exists is never revealed. */
  async resend(email: string, now = new Date()): Promise<void> {
    const user = await this.users.findActiveByEmail(email);
    if (!user || user.status !== 'active') return;
    await this.send(user, {}, now);
  }

  /** Uses a link once; the account is verified and open links are closed in one transaction. */
  async verify(token: string, now = new Date()): Promise<void> {
    const { userId, firstVerification } = await this.transactions.run(async (session) => {
      const row = await this.tokens.consume(hashToken(token), now, session);
      if (!row) throw invalidLink();

      const user = await this.users.findById(String(row.userId), session);
      if (!user || user.deletedAt) throw invalidLink();

      await this.users.markEmailVerified(user._id, now, session);
      await this.tokens.invalidateOpen(user._id, now, session);
      return { userId: String(user._id), firstVerification: user.emailVerified === false };
    });

    // Whoever clicked proved they own the inbox, but the account's password was set at sign-up by
    // whoever signed up. End every other session so nothing opened earlier survives verification.
    // The password is kept on purpose: resetting it would lock out every honest sign-up right after
    // they verify.
    if (firstVerification) await this.sessions.revokeAllForUser(userId, 'password_changed');
    // The auth cache is read by every protected request.
    this.cache.invalidate(userId);

    const user = await this.users.findById(userId);
    if (user?.role === 'CUSTOMER' && !user.deletedAt) {
      await this.notifications.notify('user.welcome', {
        to: user.email,
        name: user.name,
        shopUrl: this.config.get('APP_URL'),
      });
    }
  }

  private verificationUrl(token: string): string {
    const base =
      this.config.get('EMAIL_VERIFICATION_URL') ?? `${this.config.get('APP_URL')}/verify-email`;
    const url = new URL(base);
    url.searchParams.set('token', token);
    return url.toString();
  }
}

function invalidLink(): AppError {
  return AppError.validation(BAD_LINK, [{ path: 'token', message: BAD_LINK }]);
}
