import { normalizePkPhone, type CustomerDTO } from '@aricon/shared';
import { Injectable } from '@nestjs/common';
import { AppError } from '../../common/errors/app-error.js';
import { isDuplicateKey } from '../../common/errors/mongo-errors.js';
import { AppConfig } from '../../config/app-config.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { UsersRepository } from '../users/users.repository.js';
import type { ClientContext, IssuedTokens } from './auth.types.js';
import { CredentialsService } from './credentials.service.js';
import type { LoginDto, SignupDto } from './dto/auth.request.dto.js';
import { toCustomerDto } from './dto/auth.response.dto.js';
import { PasswordHasher } from './password-hasher.service.js';
import { TokenService } from './token.service.js';

export interface CustomerSession {
  customer: CustomerDTO;
  tokens: IssuedTokens;
}

const EMAIL_TAKEN = 'An account with this email already exists. Log in, or reset your password.';
const PHONE_TAKEN = 'An account with this mobile number already exists. Log in, or reset your password.';

/** Customer sign-up, login, refresh and logout (SPEC §6.11, §7.2). */
@Injectable()
export class CustomerAuthService {
  constructor(
    private readonly users: UsersRepository,
    private readonly credentials: CredentialsService,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenService,
    private readonly notifications: NotificationsService,
    private readonly config: AppConfig,
  ) {}

  /** Creates a CUSTOMER and signs them in. Email and phone must be unused. */
  async signup(input: SignupDto, client: ClientContext): Promise<CustomerSession> {
    if (await this.users.emailExists(input.email)) throw new AppError('EMAIL_TAKEN', EMAIL_TAKEN);
    if (await this.users.phoneExists(input.phone)) throw new AppError('PHONE_TAKEN', PHONE_TAKEN);

    let user;
    try {
      user = await this.users.create({
        name: input.name,
        email: input.email,
        phone: input.phone,
        companyName: input.companyName,
        passwordHash: await this.hasher.hash(input.password),
        role: 'CUSTOMER',
      });
    } catch (error) {
      // Two sign-ups with the same email/phone at the same moment: the unique index stops one.
      throw duplicateToAppError(error) ?? error;
    }

    const tokens = await this.tokens.startSession(String(user._id), 'customer', client);
    await this.notifications.notify('user.welcome', {
      to: user.email,
      name: user.name,
      shopUrl: this.config.get('APP_URL'),
    });
    return { customer: toCustomerDto(user), tokens };
  }

  /** `identifier` is an email or a mobile number in any accepted format. */
  async login(input: LoginDto, client: ClientContext): Promise<CustomerSession> {
    const identifier = input.identifier.trim();
    const phone = identifier.includes('@') ? null : normalizePkPhone(identifier);
    const lookup = identifier.includes('@') ? { email: identifier.toLowerCase() } : phone ? { phone } : null;

    const user = await this.credentials.authenticate(lookup, input.password, ['CUSTOMER']);
    const tokens = await this.tokens.startSession(String(user._id), 'customer', client);
    return { customer: toCustomerDto(user), tokens };
  }

  async refresh(refreshToken: string | null, client: ClientContext): Promise<CustomerSession> {
    if (!refreshToken) throw AppError.unauthenticated();
    const { userId, tokens } = await this.tokens.rotate(refreshToken, 'customer', client);
    return { customer: await this.activeCustomer(userId), tokens };
  }

  async logout(refreshToken: string | null): Promise<void> {
    if (refreshToken) await this.tokens.revokeByToken(refreshToken, 'customer', 'logout');
  }

  async me(userId: string): Promise<CustomerDTO> {
    return this.activeCustomer(userId);
  }

  private async activeCustomer(userId: string): Promise<CustomerDTO> {
    const user = await this.users.findById(userId);
    if (!user || user.role !== 'CUSTOMER') throw AppError.unauthenticated();
    if (user.status === 'blocked') {
      throw new AppError('ACCOUNT_BLOCKED', 'This account has been blocked. Contact us if you think this is a mistake.');
    }
    return toCustomerDto(user);
  }
}

/** Maps a duplicate-key error on `users` to EMAIL_TAKEN / PHONE_TAKEN. */
function duplicateToAppError(error: unknown): AppError | null {
  if (isDuplicateKey(error, 'phone')) return new AppError('PHONE_TAKEN', PHONE_TAKEN);
  if (isDuplicateKey(error)) return new AppError('EMAIL_TAKEN', EMAIL_TAKEN);
  return null;
}
