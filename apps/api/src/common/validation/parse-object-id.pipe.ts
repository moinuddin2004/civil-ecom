import { Injectable, type PipeTransform } from '@nestjs/common';
import { isValidObjectId } from 'mongoose';
import { AppError } from '../errors/app-error.js';

const OBJECT_ID = /^[a-f\d]{24}$/i;

/**
 * Route `:id` params. A value that isn't an ObjectId can't match a document, so it answers 404 (like
 * an unknown id) instead of a validation error or a CastError.
 */
@Injectable()
export class ParseObjectIdPipe implements PipeTransform<unknown, string> {
  constructor(private readonly notFoundMessage = "We couldn't find what you were looking for.") {}

  transform(value: unknown): string {
    if (typeof value === 'string' && OBJECT_ID.test(value) && isValidObjectId(value)) return value.toLowerCase();
    throw AppError.notFound(this.notFoundMessage);
  }
}
