import type { Role } from '@aricon/shared';
import { Types } from 'mongoose';
import { beforeAll, describe, expect, it } from 'vitest';
import { AppError } from '../../common/errors/app-error.js';
import type { UsersRepository, UserWithPassword } from '../users/users.repository.js';
import { LOCKOUT_MS, MAX_FAILED_LOGINS } from '../users/users.repository.js';
import { CredentialsService, INVALID_CREDENTIALS_MESSAGE } from './credentials.service.js';
import { PasswordHasher } from './password-hasher.service.js';

const hasher = new PasswordHasher();
const PASSWORD = 'Cement2026';
let passwordHash: string;

beforeAll(async () => {
  passwordHash = await hasher.hash(PASSWORD);
});

/** In-memory users with the repository's lockout semantics. */
class FakeUsers {
  constructor(public readonly users: UserWithPassword[]) {}

  async findForLogin(filter: { email: string } | { phone: string }) {
    return (
      this.users.find((user) => ('email' in filter ? user.email === filter.email : user.phone === filter.phone)) ??
      null
    );
  }

  async recordFailedLogin(id: Types.ObjectId, now: Date): Promise<Date | null> {
    const user = this.users.find((candidate) => candidate._id.equals(id));
    if (!user) return null;
    user.failedLogins += 1;
    if (user.failedLogins < MAX_FAILED_LOGINS) return null;
    user.failedLogins = 0;
    user.lockedUntil = new Date(now.getTime() + LOCKOUT_MS);
    return user.lockedUntil;
  }

  async recordSuccessfulLogin(id: Types.ObjectId, now: Date): Promise<void> {
    const user = this.users.find((candidate) => candidate._id.equals(id));
    if (user) Object.assign(user, { failedLogins: 0, lockedUntil: undefined, lastLoginAt: now });
  }
}

function makeUser(role: Role, overrides: Partial<UserWithPassword> = {}): UserWithPassword {
  return {
    _id: new Types.ObjectId(),
    name: 'Ahmed Raza',
    email: `${role.toLowerCase()}@example.com`,
    phone: '+923001234567',
    passwordHash,
    role,
    permissions: [],
    status: 'active',
    addresses: [],
    mustChangePassword: false,
    emailVerified: true,
    failedLogins: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

async function rejected(promise: Promise<unknown>): Promise<AppError> {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  if (error instanceof AppError) return error;
  throw new Error(`expected an AppError, got ${String(error)}`);
}

function service(users: FakeUsers): CredentialsService {
  return new CredentialsService(users as unknown as UsersRepository, hasher);
}

describe('CredentialsService.authenticate (SPEC §6.11)', () => {
  it('signs in with the right password and resets the failure count', async () => {
    const user = makeUser('CUSTOMER', { failedLogins: 3 });
    const result = await service(new FakeUsers([user])).authenticate({ email: user.email }, PASSWORD, ['CUSTOMER']);
    expect(result.email).toBe(user.email);
    expect('passwordHash' in result).toBe(false);
    expect(user.failedLogins).toBe(0);
  });

  it('gives an unknown account the same error as a wrong password', async () => {
    const credentials = service(new FakeUsers([makeUser('CUSTOMER')]));
    const unknown = await rejected(credentials.authenticate({ email: 'nobody@example.com' }, PASSWORD, ['CUSTOMER']));
    const wrong = await rejected(credentials.authenticate({ email: 'customer@example.com' }, 'Wrong1234', ['CUSTOMER']));
    expect(unknown.message).toBe(INVALID_CREDENTIALS_MESSAGE);
    expect(wrong.message).toBe(INVALID_CREDENTIALS_MESSAGE);
    expect(unknown.code).toBe('UNAUTHENTICATED');
  });

  it("treats staff credentials on the storefront like a wrong password (and the reverse)", async () => {
    const staff = makeUser('STAFF');
    const customer = makeUser('CUSTOMER');
    const credentials = service(new FakeUsers([staff, customer]));
    expect((await rejected(credentials.authenticate({ email: staff.email }, PASSWORD, ['CUSTOMER']))).message).toBe(
      INVALID_CREDENTIALS_MESSAGE,
    );
    expect(
      (await rejected(credentials.authenticate({ email: customer.email }, PASSWORD, ['ADMIN', 'STAFF']))).message,
    ).toBe(INVALID_CREDENTIALS_MESSAGE);
  });

  it('locks the account for 15 minutes after 5 wrong passwords, even for the right one', async () => {
    const user = makeUser('CUSTOMER');
    const credentials = service(new FakeUsers([user]));
    const now = new Date('2026-10-01T10:00:00Z');
    for (let attempt = 1; attempt < MAX_FAILED_LOGINS; attempt++) {
      expect((await rejected(credentials.authenticate({ email: user.email }, 'Wrong1234', ['CUSTOMER'], now))).code).toBe(
        'UNAUTHENTICATED',
      );
    }
    const fifth = await rejected(credentials.authenticate({ email: user.email }, 'Wrong1234', ['CUSTOMER'], now));
    expect(fifth.code).toBe('ACCOUNT_LOCKED');
    expect(fifth.status).toBe(423);
    expect(fifth.message).toContain('15 minutes');

    const stillLocked = await rejected(credentials.authenticate({ email: user.email }, PASSWORD, ['CUSTOMER'], now));
    expect(stillLocked.code).toBe('ACCOUNT_LOCKED');

    const afterLock = new Date(now.getTime() + LOCKOUT_MS + 1);
    await expect(credentials.authenticate({ email: user.email }, PASSWORD, ['CUSTOMER'], afterLock)).resolves.toBeDefined();
    // Seven bcrypt checks at cost 12 (pure-JS bcryptjs): slow on purpose, like in production.
  }, 30_000);

  it('reveals a block only to someone who knows the password', async () => {
    const user = makeUser('CUSTOMER', { status: 'blocked' });
    const credentials = service(new FakeUsers([user]));
    expect((await rejected(credentials.authenticate({ email: user.email }, 'Wrong1234', ['CUSTOMER']))).code).toBe(
      'UNAUTHENTICATED',
    );
    const blocked = await rejected(credentials.authenticate({ email: user.email }, PASSWORD, ['CUSTOMER']));
    expect(blocked.code).toBe('ACCOUNT_BLOCKED');
    expect(blocked.status).toBe(403);
  });

  it('refuses a login that has no usable identifier', async () => {
    const credentials = service(new FakeUsers([makeUser('CUSTOMER')]));
    expect((await rejected(credentials.authenticate(null, PASSWORD, ['CUSTOMER']))).code).toBe('UNAUTHENTICATED');
  });
});
