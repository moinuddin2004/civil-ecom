import type { ValidationError } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { flattenValidationErrors } from './validation.js';

function error(property: string, constraints?: Record<string, string>, children: ValidationError[] = []): ValidationError {
  return { property, constraints, children };
}

describe('flattenValidationErrors', () => {
  it('turns nested class-validator errors into dotted paths the web forms understand', () => {
    const errors = [
      error('email', { isEmail: 'Enter a valid email address.' }),
      error('items', undefined, [error('0', undefined, [error('qty', { min: 'Quantity must be at least 1.' })])]),
    ];
    expect(flattenValidationErrors(errors)).toEqual([
      { path: 'email', message: 'Enter a valid email address.' },
      { path: 'items.0.qty', message: 'Quantity must be at least 1.' },
    ]);
  });

  it('explains rejected unknown fields in plain words', () => {
    expect(flattenValidationErrors([error('role', { whitelistValidation: 'property role should not exist' })])).toEqual([
      { path: 'role', message: "This field isn't allowed." },
    ]);
  });
});
