import { z } from 'zod';
import {
  emailSchema,
  nameSchema,
  optionalText,
  passwordSchema,
  pkPhoneSchema,
  requiredText,
} from './common.js';

/** Customer and staff authentication bodies (SPEC §6.11, §7.2, §7.3). */

/**
 * Signup always creates a CUSTOMER. `role` and `permissions` in the body are accepted and dropped
 * (CLAUDE.md security rules); any other unknown key is rejected.
 */
export const signupSchema = z
  .strictObject({
    name: nameSchema,
    email: emailSchema,
    phone: pkPhoneSchema,
    password: passwordSchema,
    companyName: optionalText(120),
    role: z.unknown().optional(),
    permissions: z.unknown().optional(),
  })
  .transform(({ role: _role, permissions: _permissions, ...rest }) => rest);
export type SignupInput = z.input<typeof signupSchema>;

/** `identifier` is an email or a phone number in any accepted format. */
export const loginSchema = z.strictObject({
  identifier: requiredText(1, 254, 'Email or phone'),
  password: z.string().min(1, 'Enter your password.').max(200),
});
export type LoginInput = z.input<typeof loginSchema>;

export const adminLoginSchema = z.strictObject({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password.').max(200),
});
export type AdminLoginInput = z.input<typeof adminLoginSchema>;

export const forgotPasswordSchema = z.strictObject({ email: emailSchema });
export type ForgotPasswordInput = z.input<typeof forgotPasswordSchema>;

/** Reset tokens are 32 random bytes, base64url encoded (43 characters). */
export const resetTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/, 'This reset link is not valid.');

export const resetPasswordSchema = z.strictObject({
  token: resetTokenSchema,
  password: passwordSchema,
});
export type ResetPasswordInput = z.input<typeof resetPasswordSchema>;

/** Email verification links use the same 32-byte token format as password resets. */
export const verifyEmailSchema = z.strictObject({
  token: resetTokenSchema,
});
export type VerifyEmailInput = z.input<typeof verifyEmailSchema>;

/** Resending a verification email never reveals whether the address is registered. */
export const resendVerificationSchema = z.strictObject({ email: emailSchema });
export type ResendVerificationInput = z.input<typeof resendVerificationSchema>;

export const changePasswordSchema = z
  .strictObject({
    currentPassword: z.string().min(1, 'Enter your current password.').max(200),
    newPassword: passwordSchema,
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    path: ['newPassword'],
    message: 'Choose a password different from the current one.',
  });
export type ChangePasswordInput = z.input<typeof changePasswordSchema>;
