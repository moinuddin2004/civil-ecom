import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
  adminLoginSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
} from './auth.js';

/** Issue paths and messages of a failed parse ([] when it passes). */
function issues(schema: z.ZodType, input: unknown) {
  const result = schema.safeParse(input);
  return result.success ? [] : result.error.issues.map(({ path, message, code }) => ({ path, message, code }));
}

const signup = {
  name: '  Ali Khan ',
  email: ' Ali.Khan@Example.COM ',
  phone: '0300-1234567',
  password: 'secret123',
  companyName: 'Khan Builders',
};

describe('signupSchema (SPEC §6.11)', () => {
  it('normalises name, email and phone', () => {
    expect(signupSchema.parse(signup)).toEqual({
      name: 'Ali Khan',
      email: 'ali.khan@example.com',
      phone: '+923001234567',
      password: 'secret123',
      companyName: 'Khan Builders',
    });
  });

  it('drops role and permissions instead of passing them on (signup is always CUSTOMER)', () => {
    const data = signupSchema.parse({ ...signup, role: 'ADMIN', permissions: ['orders.view', 'orders.cancel'] });
    expect(data).not.toHaveProperty('role');
    expect(data).not.toHaveProperty('permissions');
    expect(Object.keys(data).sort()).toEqual(['companyName', 'email', 'name', 'password', 'phone']);
  });

  it.each(['isAdmin', 'status', 'mustChangePassword', 'passwordHash', 'addresses'])(
    'rejects any other unknown key (%s)',
    (key) => {
      const result = issues(signupSchema, { ...signup, [key]: true });
      expect(result).toHaveLength(1);
      expect(result[0]?.code).toBe('unrecognized_keys');
    },
  );

  it('makes the company optional and treats an empty one as not given', () => {
    const { companyName: _omit, ...withoutCompany } = signup;
    expect(signupSchema.parse(withoutCompany)).not.toHaveProperty('companyName', expect.anything());
    expect(signupSchema.parse({ ...signup, companyName: '   ' }).companyName).toBeUndefined();
  });

  it('rejects a phone that is not a Pakistani mobile number, saying how to fix it', () => {
    expect(issues(signupSchema, { ...signup, phone: '021 34567890' })).toEqual([
      { path: ['phone'], message: 'Enter an 11-digit mobile number, like 0300 1234567.', code: 'custom' },
    ]);
  });

  it('requires every field except the company', () => {
    for (const key of ['name', 'email', 'phone', 'password'] as const) {
      const input: Record<string, unknown> = { ...signup };
      delete input[key];
      expect(issues(signupSchema, input).map((i) => i.path)).toContainEqual([key]);
    }
  });

  it('checks name length (2–80) and email format', () => {
    expect(issues(signupSchema, { ...signup, name: 'A' })).not.toEqual([]);
    expect(issues(signupSchema, { ...signup, name: ' A ' })).not.toEqual([]);
    expect(issues(signupSchema, { ...signup, name: 'A'.repeat(81) })).not.toEqual([]);
    expect(issues(signupSchema, { ...signup, name: 'Al' })).toEqual([]);
    expect(issues(signupSchema, { ...signup, email: 'not-an-email' }).map((i) => i.path)).toEqual([['email']]);
  });
});

describe('password rules (8–72 characters, a letter and a number)', () => {
  const password = (value: string) => issues(signupSchema, { ...signup, password: value }).map((i) => i.message);

  it('accepts the boundaries', () => {
    expect(password('abcdefg1')).toEqual([]);
    expect(password('a1'.repeat(36))).toEqual([]);
    expect(password('Pass word 2026!')).toEqual([]);
  });

  it('rejects passwords that are too short or too long', () => {
    expect(password('abcdef1')).toContain('Use at least 8 characters.');
    expect(password('a1'.repeat(36) + 'x')).toContain('Use at most 72 characters.');
  });

  it('needs at least one letter and one number', () => {
    expect(password('abcdefgh')).toEqual(['Include at least one number.']);
    expect(password('12345678')).toEqual(['Include at least one letter.']);
    expect(password('!!!!!!!!')).toEqual(['Include at least one letter.', 'Include at least one number.']);
  });

  it('keeps spaces in the password as typed', () => {
    expect(signupSchema.parse({ ...signup, password: ' secret12 ' }).password).toBe(' secret12 ');
  });
});

describe('login schemas', () => {
  it('customer login takes an identifier and a password, nothing else', () => {
    expect(loginSchema.parse({ identifier: ' 0300 1234567 ', password: 'x' })).toEqual({
      identifier: '0300 1234567',
      password: 'x',
    });
    expect(issues(loginSchema, { identifier: '', password: 'x' }).map((i) => i.path)).toEqual([['identifier']]);
    expect(issues(loginSchema, { identifier: 'a@b.co', password: '' }).map((i) => i.path)).toEqual([['password']]);
    expect(issues(loginSchema, { identifier: 'a@b.co', password: 'x', role: 'ADMIN' })[0]?.code).toBe(
      'unrecognized_keys',
    );
  });

  it('admin login normalises the email', () => {
    expect(adminLoginSchema.parse({ email: ' Admin@Aricon.com.pk ', password: 'x' }).email).toBe('admin@aricon.com.pk');
  });

  it('forgot password takes a valid email only', () => {
    expect(forgotPasswordSchema.parse({ email: 'A@B.CO' })).toEqual({ email: 'a@b.co' });
    expect(issues(forgotPasswordSchema, { email: 'nope' })).not.toEqual([]);
  });
});

describe('password reset and change', () => {
  const token = 'A'.repeat(40) + '-_9';

  it('accepts a 43-character base64url token and applies the password rules', () => {
    expect(issues(resetPasswordSchema, { token, password: 'newpass12' })).toEqual([]);
    expect(issues(resetPasswordSchema, { token: token.slice(1), password: 'newpass12' }).map((i) => i.path)).toEqual([
      ['token'],
    ]);
    expect(issues(resetPasswordSchema, { token: token.slice(1) + '=', password: 'newpass12' })).not.toEqual([]);
    expect(issues(resetPasswordSchema, { token, password: 'short' }).map((i) => i.path)).toContainEqual(['password']);
  });

  it('requires a new password different from the current one', () => {
    expect(issues(changePasswordSchema, { currentPassword: 'secret123', newPassword: 'secret123' })).toEqual([
      { path: ['newPassword'], message: 'Choose a password different from the current one.', code: 'custom' },
    ]);
    expect(issues(changePasswordSchema, { currentPassword: 'secret123', newPassword: 'secret124' })).toEqual([]);
    expect(issues(changePasswordSchema, { currentPassword: '', newPassword: 'secret124' }).map((i) => i.path)).toEqual([
      ['currentPassword'],
    ]);
  });
});
