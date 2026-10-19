/**
 * The listed keys that were actually sent (not `undefined`) — the `$set` of a PATCH. `null` is kept:
 * on fields that allow it, it means "clear" (e.g. a delivery fee falling back to the default).
 */
export function definedOnly<T extends object, K extends keyof T>(input: T, keys: readonly K[]): Partial<Pick<T, K>> {
  const out: Partial<Pick<T, K>> = {};
  for (const key of keys) if (input[key] !== undefined) out[key] = input[key];
  return out;
}
