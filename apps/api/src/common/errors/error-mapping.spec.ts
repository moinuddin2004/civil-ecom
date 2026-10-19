import { NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { model, mongo, Error as MongooseError, Schema } from 'mongoose';
import { describe, expect, it } from 'vitest';
import { AppError } from './app-error.js';
import { INTERNAL_MESSAGE, toErrorResponse } from './error-mapping.js';

describe('toErrorResponse', () => {
  it('uses an AppError as it is, with the status SPEC §7.1 assigns to its code', () => {
    expect(toErrorResponse(new AppError('EMAIL_TAKEN', 'This email is already registered.'))).toEqual({
      status: 409,
      body: { error: { code: 'EMAIL_TAKEN', message: 'This email is already registered.' } },
    });
    expect(toErrorResponse(AppError.validation('Fix the fields.', [{ path: 'email', message: 'Required.' }]))).toEqual({
      status: 400,
      body: { error: { code: 'VALIDATION_ERROR', message: 'Fix the fields.', details: [{ path: 'email', message: 'Required.' }] } },
    });
  });

  it("maps Nest's own exceptions to our codes and wording", () => {
    expect(toErrorResponse(new NotFoundException('Cannot GET /api/nope')).body.error).toEqual({
      code: 'NOT_FOUND',
      message: "This endpoint doesn't exist.",
    });
    expect(toErrorResponse(new PayloadTooLargeException()).body.error.code).toBe('PAYLOAD_TOO_LARGE');
    expect(toErrorResponse(new ThrottlerException()).status).toBe(429);
    expect(toErrorResponse(new ThrottlerException()).body.error.code).toBe('RATE_LIMITED');
  });

  it('maps a duplicate-key error to CONFLICT', () => {
    const duplicate = new mongo.MongoServerError({ message: 'E11000 duplicate key', code: 11000 });
    expect(toErrorResponse(duplicate)).toMatchObject({ status: 409, body: { error: { code: 'CONFLICT' } } });
  });

  it('maps a concurrent edit (VersionError) to CONFLICT', () => {
    const Probe = model('VersionProbe', new Schema({ tags: [String] }));
    const version = new MongooseError.VersionError(new Probe(), 1, ['tags']);
    expect(toErrorResponse(version)).toMatchObject({ status: 409, body: { error: { code: 'CONFLICT' } } });
  });

  it('reports a malformed id as a validation error on that field', () => {
    const cast = new MongooseError.CastError('ObjectId', 'not-an-id', 'orderId');
    expect(toErrorResponse(cast)).toMatchObject({
      status: 400,
      body: { error: { code: 'VALIDATION_ERROR', details: [{ path: 'orderId' }] } },
    });
  });

  it('formats body-parser errors', () => {
    const invalidJson = Object.assign(new Error('Unexpected token'), { status: 400, type: 'entity.parse.failed' });
    expect(toErrorResponse(invalidJson).body.error).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'The request body is not valid JSON.',
    });
    const tooLarge = Object.assign(new Error('too large'), { status: 413, type: 'entity.too.large' });
    expect(toErrorResponse(tooLarge).body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('never leaks the message of an unexpected error', () => {
    const result = toErrorResponse(new Error('connection to 10.0.0.5 refused: password=hunter2'));
    expect(result).toEqual({ status: 500, body: { error: { code: 'INTERNAL', message: INTERNAL_MESSAGE } } });
  });
});
