import { Catch, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { PinoLogger } from 'nestjs-pino';
import { toErrorResponse } from './error-mapping.js';

/**
 * The single place where errors become HTTP responses (CLAUDE.md §11) — the equivalent of a
 * Spring `@ControllerAdvice`. Server errors are logged with the request id (nestjs-pino binds the
 * request logger); client errors are expected and only logged at debug level.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(AllExceptionsFilter.name);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const { status, body } = toErrorResponse(exception);

    if (status >= 500) this.logger.error({ err: exception }, 'Request failed');
    else this.logger.debug({ code: body.error.code, status }, 'Request rejected');

    // The response already started streaming; Express will close the connection.
    if (response.headersSent) return;
    response.status(status).json(body);
  }
}
