import { describe, expect, it } from 'vitest';
import type { AppConfig } from '../../config/app-config.service.js';
import type { UsersRepository } from '../users/users.repository.js';
import { AuthUserCache } from './auth-user-cache.service.js';

const config = { get: () => 900 } as unknown as AppConfig;

describe('AuthUserCache revoked families', () => {
  it('refuses a revoked family only while its access tokens could still be valid', () => {
    const cache = new AuthUserCache({} as UsersRepository, config);
    const now = 1_000_000;
    cache.revokeFamilyAccess('family-1', now);

    expect(cache.isFamilyRevoked('family-1', now + 1)).toBe(true);
    expect(cache.isFamilyRevoked('other', now + 1)).toBe(false);
    expect(cache.isFamilyRevoked('family-1', now + 900_000)).toBe(false);
  });
});
