import { mongo } from 'mongoose';

/**
 * A unique-index violation (E11000), optionally on a given field. Services check uniqueness first
 * for a friendly message; this catches the race where two writes pass that check together.
 */
export function isDuplicateKey(error: unknown, field?: string): boolean {
  if (!(error instanceof mongo.MongoServerError) || error.code !== 11000) return false;
  if (!field) return true;
  return Object.keys((error.keyPattern ?? {}) as Record<string, unknown>).includes(field);
}
