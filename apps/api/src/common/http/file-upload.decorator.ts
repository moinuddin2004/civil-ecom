import { formatFileSize } from '@aricon/shared';
import {
  applyDecorators,
  HttpException,
  HttpStatus,
  Injectable,
  UseInterceptors,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
  type Type,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes } from '@nestjs/swagger';
import { catchError, type Observable } from 'rxjs';
import { AppError } from '../errors/app-error.js';

/** Extra multipart fields an upload may carry next to the file (e.g. `productId`). */
const MAX_FIELDS = 5;

/** Multer refuses an oversized file with a bare 413; this says what the limit is. */
function uploadLimitMessage(maxBytes: number): Type<NestInterceptor> {
  @Injectable()
  class UploadLimitMessage implements NestInterceptor {
    intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
      return next.handle().pipe(
        catchError((error: unknown) => {
          if (error instanceof HttpException && error.getStatus() === HttpStatus.PAYLOAD_TOO_LARGE) {
            throw new AppError('PAYLOAD_TOO_LARGE', `The file is too large. Choose one under ${formatFileSize(maxBytes)}.`);
          }
          throw error;
        }),
      );
    }
  }
  return UploadLimitMessage;
}

/**
 * One multipart file in the field `file`, kept in memory (CLAUDE.md §4 "Multer memory storage") and
 * cut off at `maxBytes` while it is still streaming in. The real type and the processing are
 * checked by `FileProcessingService`.
 */
export function FileUpload(maxBytes: number, fields: Record<string, { type: 'string'; description: string }> = {}) {
  return applyDecorators(
    UseInterceptors(
      uploadLimitMessage(maxBytes),
      FileInterceptor('file', { limits: { fileSize: maxBytes, files: 1, fields: MAX_FIELDS, parts: MAX_FIELDS + 1 } }),
    ),
    ApiConsumes('multipart/form-data'),
    ApiBody({
      schema: {
        type: 'object',
        required: ['file'],
        properties: { file: { type: 'string', format: 'binary' }, ...fields },
      },
    }),
  );
}
