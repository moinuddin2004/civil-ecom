import type { ErrorRequestHandler } from 'express';
import { toErrorResponse } from './error-mapping.js';

/**
 * Body parsers run as plain Express middleware, before Nest's router, so their errors (invalid
 * JSON, body too large) never reach the exception filter. This handler sits right after them and
 * formats those errors exactly like every other API error.
 */
export const bodyParserErrorHandler: ErrorRequestHandler = (err: unknown, _req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  const { status, body } = toErrorResponse(err);
  res.status(status).json(body);
};
