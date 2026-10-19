import { isValidSlug, SLUG_MAX } from '@aricon/shared';
import { Injectable, type PipeTransform } from '@nestjs/common';
import { AppError } from '../errors/app-error.js';

/**
 * Route `:slug` params. A value that can't be a slug can't match anything either, so it answers 404
 * (like an unknown slug) instead of a validation error.
 */
@Injectable()
export class ParseSlugPipe implements PipeTransform<unknown, string> {
  constructor(private readonly notFoundMessage = "We couldn't find what you were looking for.") {}

  transform(value: unknown): string {
    if (typeof value === 'string' && value.length <= SLUG_MAX && isValidSlug(value)) return value;
    throw AppError.notFound(this.notFoundMessage);
  }
}
