import { AppError } from '../../common/errors/app-error.js';

export const EMAIL_NOT_VERIFIED_MESSAGE =
  'Verify your email address before signing in. We sent you a link; you can ask for a new one if it expired.';

/**
 * The one answer for an unverified account. The email is included so the web app can offer a
 * "resend verification email" action without asking for it again.
 */
export function emailNotVerifiedError(email?: string): AppError {
  return new AppError('EMAIL_NOT_VERIFIED', EMAIL_NOT_VERIFIED_MESSAGE, {
    ...(email ? { email } : {}),
    canResend: true,
  });
}
