import { Injectable, StreamableFile, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { map, type Observable } from 'rxjs';
import { Paginated, RAW_RESPONSE } from './envelope.js';

/**
 * Wraps every successful response in the API's envelope (CLAUDE.md §10), so controllers return
 * plain values: `T` → `{ data: T }`, `Paginated<T>` → `{ data, meta }`. `undefined` (204 handlers),
 * files and `@RawResponse()` handlers pass through untouched.
 */
@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const raw = this.reflector.getAllAndOverride<boolean | undefined>(RAW_RESPONSE, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (raw || context.getType() !== 'http') return next.handle();

    return next.handle().pipe(
      map((value: unknown) => {
        if (value === undefined || value instanceof StreamableFile) return value;
        if (value instanceof Paginated) return { ...value.extra, data: value.data, meta: value.meta };
        return { data: value };
      }),
    );
  }
}
