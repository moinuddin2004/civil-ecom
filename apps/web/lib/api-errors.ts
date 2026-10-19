import { isErrorCode, type ErrorCode } from '@aricon/shared';
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';

/**
 * Errors from the API as one type for server components, browser calls and forms. The API sends
 * `{ error: { code, message, details? } }` (SPEC §7.1); `message` is written for people, so the UI
 * can show it as it is.
 */
export class ApiError extends Error {
  override readonly name = 'ApiError';

  constructor(
    readonly code: ErrorCode,
    /** HTTP status; 0 when the request never reached the server. */
    readonly status: number,
    message: string,
    readonly details?: unknown,
    options?: { cause?: unknown },
  ) {
    super(message, options);
  }
}

/**
 * `instanceof` plus a structural check: after a hot reload in development the class can be a
 * different copy than the one that threw.
 */
export function isApiError(value: unknown): value is ApiError {
  if (value instanceof ApiError) return true;
  if (!(value instanceof Error) || value.name !== 'ApiError') return false;
  const candidate = value as Partial<Record<'code' | 'status', unknown>>;
  return isErrorCode(candidate.code) && typeof candidate.status === 'number';
}

export function isNotFoundError(value: unknown): boolean {
  return isApiError(value) && value.status === 404;
}

/** The request never got an answer (offline, DNS, connection reset, timeout). */
export function isNetworkError(value: unknown): boolean {
  return isApiError(value) && value.status === 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Codes and wording for responses without our JSON error body (Nginx, Cloudflare, proxies). */
const STATUS_FALLBACK: Record<number, { code: ErrorCode; message: string }> = {
  400: { code: 'VALIDATION_ERROR', message: 'Some details are missing or invalid. Check them and try again.' },
  401: { code: 'UNAUTHENTICATED', message: 'Please log in to continue.' },
  403: { code: 'FORBIDDEN', message: "You don't have access to this." },
  404: { code: 'NOT_FOUND', message: "We couldn't find what you were looking for." },
  409: { code: 'CONFLICT', message: 'This changed in the meantime. Refresh the page and try again.' },
  413: { code: 'PAYLOAD_TOO_LARGE', message: 'This file is too large. Choose a smaller file.' },
  415: { code: 'UNSUPPORTED_FILE', message: "This file type isn't supported." },
  423: { code: 'ACCOUNT_LOCKED', message: 'This account is locked for a few minutes. Try again later.' },
  429: { code: 'RATE_LIMITED', message: 'Too many attempts. Wait a few minutes and try again.' },
};

const SERVER_TROUBLE = "We couldn't reach the shop right now. Please try again in a moment.";

/** Builds an ApiError from a failed response's status and parsed body (any shape). */
export function errorFromResponse(status: number, body: unknown): ApiError {
  if (isRecord(body) && isRecord(body.error)) {
    const { code, message, details } = body.error;
    if (isErrorCode(code) && typeof message === 'string') {
      return new ApiError(code, status, message, details);
    }
  }
  const fallback = STATUS_FALLBACK[status];
  if (fallback) return new ApiError(fallback.code, status, fallback.message);
  if (status >= 400 && status < 500) {
    return new ApiError('VALIDATION_ERROR', status, 'The request could not be completed. Please try again.');
  }
  return new ApiError('INTERNAL', status, SERVER_TROUBLE);
}

/** A request that failed before any response (fetch threw, XHR `error` event, or a timeout). */
export function networkError(cause?: unknown): ApiError {
  const timedOut = cause instanceof Error && cause.name === 'TimeoutError';
  return new ApiError(
    'INTERNAL',
    0,
    timedOut
      ? 'The shop took too long to answer. Please try again.'
      : "Couldn't connect. Check your internet connection and try again.",
    undefined,
    { cause },
  );
}

/** Message to show for any thrown value; unknown errors get `fallback`, never a raw message. */
export function errorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  return isApiError(error) ? error.message : fallback;
}

export interface FieldError {
  /** Dotted path as the API reports it, e.g. `email` or `items.0.qty`. */
  path: string;
  message: string;
}

/** Errors that belong to one field even though the API reports them as a code. */
const CODE_FIELDS: Partial<Record<ErrorCode, string>> = {
  EMAIL_TAKEN: 'email',
  PHONE_TAKEN: 'phone',
};

/**
 * Field errors in an API error: the `details` list of `VALIDATION_ERROR` (`[{ path, message }]`),
 * or the field that `EMAIL_TAKEN` / `PHONE_TAKEN` refer to.
 */
export function fieldErrors(error: unknown): FieldError[] {
  if (!isApiError(error)) return [];

  const codeField = CODE_FIELDS[error.code];
  if (codeField) return [{ path: codeField, message: error.message }];

  if (error.code !== 'VALIDATION_ERROR' || !Array.isArray(error.details)) return [];
  const result: FieldError[] = [];
  for (const entry of error.details as unknown[]) {
    if (!isRecord(entry) || typeof entry.path !== 'string' || typeof entry.message !== 'string') continue;
    const path = entry.path.replace(/^body\./, '');
    if (path) result.push({ path, message: entry.message });
  }
  return result;
}

export interface ApplyFieldErrorsOptions<T extends FieldValues> {
  /** Only these fields are set; errors for other paths are left for a form-level message. */
  fields?: readonly Path<T>[];
}

/**
 * Puts the API's field errors on a React Hook Form form and focuses the first one.
 * Returns true when at least one field got an error; otherwise show `error.message` near the
 * submit button instead.
 *
 * @example
 * catch (error) { if (!applyFieldErrors(error, form.setError)) setFormError(errorMessage(error)); }
 */
export function applyFieldErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  options: ApplyFieldErrorsOptions<T> = {},
): boolean {
  const allowed = options.fields ? new Set<string>(options.fields) : null;
  const seen = new Set<string>();
  let applied = 0;
  for (const { path, message } of fieldErrors(error)) {
    if ((allowed && !allowed.has(path)) || seen.has(path)) continue;
    seen.add(path);
    setError(path as Path<T>, { type: 'server', message }, { shouldFocus: applied === 0 });
    applied += 1;
  }
  return applied > 0;
}
