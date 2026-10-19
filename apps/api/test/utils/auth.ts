import type { Permission, Role } from '@aricon/shared';
import type { INestApplication } from '@nestjs/common';
import type { Response } from 'supertest';
import { PasswordHasher } from '../../src/modules/auth/password-hasher.service.js';
import { UsersRepository } from '../../src/modules/users/users.repository.js';

export const ORIGIN = 'http://localhost:3000';
export const PASSWORD = 'Cement2026';

/** Cookies from a response's `Set-Cookie` headers, by name (value plus the raw header). */
export function setCookies(res: Response): Map<string, { value: string; header: string }> {
  const raw = res.headers['set-cookie'] as unknown;
  const headers = Array.isArray(raw) ? (raw as string[]) : typeof raw === 'string' ? [raw] : [];
  const cookies = new Map<string, { value: string; header: string }>();
  for (const header of headers) {
    const [pair = ''] = header.split(';');
    const index = pair.indexOf('=');
    cookies.set(pair.slice(0, index), { value: decodeURIComponent(pair.slice(index + 1)), header });
  }
  return cookies;
}

let counter = 0;

/** A unique email/phone pair for one test. */
export function uniqueContact(): { email: string; phone: string } {
  counter += 1;
  const suffix = String(Date.now() % 1_000_000).padStart(6, '0') + String(counter % 1000).padStart(3, '0');
  return { email: `user${suffix}@example.com`, phone: `+923${suffix.slice(-9).padStart(9, '0')}` };
}

/** Creates a staff/admin account directly (there is no staff-management API yet). */
export async function createStaff(
  app: INestApplication,
  options: { role?: Extract<Role, 'ADMIN' | 'STAFF'>; permissions?: Permission[]; mustChangePassword?: boolean } = {},
): Promise<{ email: string; password: string; id: string }> {
  const { email } = uniqueContact();
  const passwordHash = await app.get(PasswordHasher).hash(PASSWORD);
  const user = await app.get(UsersRepository).create({
    name: 'Staff Member',
    email,
    passwordHash,
    role: options.role ?? 'STAFF',
    permissions: options.permissions ?? [],
    mustChangePassword: options.mustChangePassword ?? false,
  });
  return { email, password: PASSWORD, id: String(user._id) };
}
