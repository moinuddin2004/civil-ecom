import { ValidationPipe, type ValidationError } from '@nestjs/common';
import { AppError, type FieldIssue } from '../errors/app-error.js';

/**
 * Flattens class-validator's nested errors into `{ path, message }` rows (`items.0.qty`), the
 * shape the web app's `fieldErrors()` puts on form fields.
 */
export function flattenValidationErrors(errors: ValidationError[], parent = ''): FieldIssue[] {
  const issues: FieldIssue[] = [];
  for (const error of errors) {
    const path = parent ? `${parent}.${error.property}` : error.property;
    for (const [constraint, message] of Object.entries(error.constraints ?? {})) {
      issues.push({ path, message: constraint === 'whitelistValidation' ? "This field isn't allowed." : message });
    }
    if (error.children?.length) issues.push(...flattenValidationErrors(error.children, path));
  }
  return issues;
}

/**
 * Global request validation (CLAUDE.md §9): DTO classes validate body, query and params; unknown
 * keys are rejected, not silently dropped (SPEC §7.1 "strict"), and payloads are transformed into
 * DTO instances so defaults and `@Type()` conversions apply.
 */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    validationError: { target: false, value: false },
    exceptionFactory: (errors) =>
      AppError.validation('Some fields are missing or invalid.', flattenValidationErrors(errors)),
  });
}
