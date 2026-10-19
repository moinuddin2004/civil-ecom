import { ERROR_STATUS, type ErrorCode } from '@aricon/shared';

/** One field problem, as the web app's `fieldErrors()` reads it: `{ path: 'items.0.qty', message }`. */
export interface FieldIssue {
  path: string;
  message: string;
}

/**
 * The only error type services throw on purpose (CLAUDE.md §11). The global exception filter turns
 * it into `{ error: { code, message, details? } }` with `status`.
 *
 * `message` is shown to people as it is: plain words that say how to fix the problem (SPEC §15).
 * The status defaults to the one SPEC §7.1 assigns to the code.
 */
export class AppError extends Error {
  override readonly name = 'AppError';
  readonly status: number;

  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
    status?: number,
  ) {
    super(message);
    this.status = status ?? ERROR_STATUS[code];
  }

  static validation(message: string, issues?: FieldIssue[]): AppError {
    return new AppError('VALIDATION_ERROR', message, issues);
  }

  static unauthenticated(message = 'Please log in to continue.'): AppError {
    return new AppError('UNAUTHENTICATED', message);
  }

  static forbidden(message = "You don't have permission to do this."): AppError {
    return new AppError('FORBIDDEN', message);
  }

  static notFound(message = "We couldn't find what you were looking for."): AppError {
    return new AppError('NOT_FOUND', message);
  }

  static conflict(message: string, details?: unknown): AppError {
    return new AppError('CONFLICT', message, details);
  }
}
