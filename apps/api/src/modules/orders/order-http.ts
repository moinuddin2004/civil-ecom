import { IDEMPOTENCY_HEADER, ORDER_NUMBER_PATTERN } from '@aricon/shared';
import { createParamDecorator, Injectable, type ExecutionContext, type PipeTransform } from '@nestjs/common';
import type { Request } from 'express';
import { AppError } from '../../common/errors/app-error.js';

const UUID_V4 = /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i;

/**
 * The checkout `Idempotency-Key` header (SPEC §6.6): a UUID v4 the browser makes once per checkout,
 * so a retried or double-clicked "Place order" returns the same order instead of a second one.
 */
export const IdempotencyKey = createParamDecorator((_data: unknown, context: ExecutionContext): string => {
  const value = context.switchToHttp().getRequest<Request>().header(IDEMPOTENCY_HEADER);
  if (!value || !UUID_V4.test(value.trim())) {
    const message = `Send an ${IDEMPOTENCY_HEADER} header with a new UUID v4 for each checkout.`;
    throw AppError.validation(message, [{ path: IDEMPOTENCY_HEADER, message }]);
  }
  return value.trim().toLowerCase();
});

/** `:orderNumber` route params (`ARC-2026-000123`); anything else can't be an order → 404. */
@Injectable()
export class ParseOrderNumberPipe implements PipeTransform<unknown, string> {
  transform(value: unknown): string {
    if (typeof value === 'string' && value.length <= 20 && ORDER_NUMBER_PATTERN.test(value)) return value;
    throw AppError.notFound("We couldn't find that order.");
  }
}
