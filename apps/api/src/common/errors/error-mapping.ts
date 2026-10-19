import type { ApiErrorResponse, ErrorCode } from '@aricon/shared';
import { HttpException } from '@nestjs/common';
import { mongo, Error as MongooseError } from 'mongoose';
import { AppError, type FieldIssue } from './app-error.js';

export interface ErrorResponse {
  status: number;
  body: ApiErrorResponse;
}

export const INTERNAL_MESSAGE = 'Something went wrong on our side. Please try again.';

function response(code: ErrorCode, status: number, message: string, details?: unknown): ErrorResponse {
  return { status, body: { error: details === undefined ? { code, message } : { code, message, details } } };
}

/** Errors from Express's body parsers (http-errors) carry `status` and `type`. */
interface HttpLikeError extends Error {
  status: number;
  type?: string;
}

function isHttpLikeError(err: unknown): err is HttpLikeError {
  return err instanceof Error && typeof (err as Partial<HttpLikeError>).status === 'number';
}

/** Framework 4xx statuses (route not found, body too large…) → our codes and wording. */
function fromStatus(status: number, type?: string): ErrorResponse {
  switch (status) {
    case 401:
      return response('UNAUTHENTICATED', 401, 'Please log in to continue.');
    case 403:
      return response('FORBIDDEN', 403, "You don't have permission to do this.");
    case 404:
      return response('NOT_FOUND', 404, "This endpoint doesn't exist.");
    case 413:
      return response('PAYLOAD_TOO_LARGE', 413, 'The request is too large.');
    case 415:
      return response('UNSUPPORTED_FILE', 415, 'This content type or encoding is not supported.');
    case 429:
      return response('RATE_LIMITED', 429, 'Too many attempts. Wait a few minutes and try again.');
    default:
      return response(
        'VALIDATION_ERROR',
        400,
        type === 'entity.parse.failed' ? 'The request body is not valid JSON.' : 'The request could not be read.',
      );
  }
}

/**
 * Maps any thrown value to the API error shape (CLAUDE.md §10–11). Anything we didn't throw on
 * purpose becomes a generic 500, so stack traces and driver messages never reach a client.
 */
export function toErrorResponse(err: unknown): ErrorResponse {
  if (err instanceof AppError) return response(err.code, err.status, err.message, err.details);

  // Nest's own exceptions: unmatched routes (404), throttling (429), guards (403)…
  if (err instanceof HttpException) {
    const status = err.getStatus();
    return status >= 500 ? response('INTERNAL', 500, INTERNAL_MESSAGE) : fromStatus(status);
  }

  // Duplicate key on a unique index. Services map the ones they expect (EMAIL_TAKEN…); this is
  // the fallback for a race they couldn't see coming.
  if (err instanceof mongo.MongoServerError && err.code === 11000) {
    return response('CONFLICT', 409, 'This already exists. Refresh the page and try again.');
  }

  // Optimistic concurrency: the document's array changed between our read and `save()`.
  if (err instanceof MongooseError.VersionError) {
    return response('CONFLICT', 409, 'This changed while you were editing. Reload the page and try again.');
  }

  // A malformed id reached a query (e.g. /orders/not-an-id).
  if (err instanceof MongooseError.CastError) {
    return response('VALIDATION_ERROR', 400, 'One of the ids in this request is not valid.', [
      { path: err.path, message: 'Not a valid id.' } satisfies FieldIssue,
    ]);
  }

  // Schema validators are the last line of defence behind the DTOs; report them like DTO errors.
  if (err instanceof MongooseError.ValidationError) {
    const details: FieldIssue[] = Object.values(err.errors).map((issue) => ({
      path: issue.path,
      message: issue.message,
    }));
    return response('VALIDATION_ERROR', 400, 'Some fields are missing or invalid.', details);
  }

  // Raw Express middleware (body parsers) errors.
  if (isHttpLikeError(err) && err.status >= 400 && err.status < 500) return fromStatus(err.status, err.type);

  return response('INTERNAL', 500, INTERNAL_MESSAGE);
}
