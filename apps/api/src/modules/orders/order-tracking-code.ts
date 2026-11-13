import { randomInt } from 'node:crypto';

/** A random 6-digit tracking code (`100000`–`999999`, no leading zero, so it never loses digits when copied). */
export function newTrackingCode(): string {
  return String(randomInt(100_000, 1_000_000));
}
