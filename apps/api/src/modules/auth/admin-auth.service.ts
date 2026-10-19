import { STAFF_ROLES, type AdminMeDTO } from '@aricon/shared';
import { Injectable } from '@nestjs/common';
import { AppError } from '../../common/errors/app-error.js';
import { UsersRepository } from '../users/users.repository.js';
import { AuthUserCache } from './auth-user-cache.service.js';
import type { ClientContext, IssuedTokens, Principal } from './auth.types.js';
import { CredentialsService } from './credentials.service.js';
import type { AdminLoginDto, ChangePasswordDto } from './dto/auth.request.dto.js';
import { toAdminMeDto } from './dto/auth.response.dto.js';
import { PasswordHasher } from './password-hasher.service.js';
import { TokenService } from './token.service.js';

export interface StaffSession {
  me: AdminMeDTO;
  tokens: IssuedTokens;
}

/** Staff/admin login, refresh, logout, "me" and password change (SPEC §6.11, §7.3, §10.1). */
@Injectable()
export class AdminAuthService {
  constructor(
    private readonly users: UsersRepository,
    private readonly credentials: CredentialsService,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenService,
    private readonly cache: AuthUserCache,
  ) {}

  /** Only ADMIN and STAFF accounts; customers get the generic credentials error. */
  async login(input: AdminLoginDto, client: ClientContext): Promise<StaffSession> {
    const user = await this.credentials.authenticate({ email: input.email }, input.password, STAFF_ROLES);
    const tokens = await this.tokens.startSession(String(user._id), 'admin', client);
    return { me: toAdminMeDto(user), tokens };
  }

  async refresh(refreshToken: string | null, client: ClientContext): Promise<StaffSession> {
    if (!refreshToken) throw AppError.unauthenticated();
    const { userId, tokens } = await this.tokens.rotate(refreshToken, 'admin', client);
    return { me: await this.activeStaff(userId), tokens };
  }

  async logout(refreshToken: string | null): Promise<void> {
    if (refreshToken) await this.tokens.revokeByToken(refreshToken, 'admin', 'logout');
  }

  me(userId: string): Promise<AdminMeDTO> {
    return this.activeStaff(userId);
  }

  /**
   * Allowed even while `mustChangePassword` is set (that is what clears it). Every other login of
   * this staff member is signed out; this one stays signed in.
   */
  async changePassword(principal: Principal, input: ChangePasswordDto): Promise<AdminMeDTO> {
    if (input.currentPassword === input.newPassword) {
      throw AppError.validation('Choose a password different from the current one.', [
        { path: 'newPassword', message: 'Choose a password different from the current one.' },
      ]);
    }
    await this.credentials.verifyCurrentPassword(principal.userId, input.currentPassword);
    await this.users.setPassword(principal.userId, await this.hasher.hash(input.newPassword));
    await this.tokens.revokeAllForUser(principal.userId, 'password_changed', { exceptFamilyId: principal.familyId });
    this.cache.invalidate(principal.userId);
    return this.activeStaff(principal.userId);
  }

  private async activeStaff(userId: string): Promise<AdminMeDTO> {
    const user = await this.users.findById(userId);
    if (!user || user.role === 'CUSTOMER') throw AppError.unauthenticated();
    if (user.status === 'blocked') {
      throw new AppError('ACCOUNT_BLOCKED', 'This account has been blocked. Contact an admin.');
    }
    return toAdminMeDto(user);
  }
}
