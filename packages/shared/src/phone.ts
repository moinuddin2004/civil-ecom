/**
 * Pakistani mobile numbers (CLAUDE.md "Phone numbers"): stored as `+923XXXXXXXXX`; people may type
 * `03XX…`, `3XX…`, `923XX…` or `+923XX…`, with spaces, dashes or brackets.
 */

const E164 = /^\+923\d{9}$/;

/** Returns `+923XXXXXXXXX`, or null when the input is not a Pakistani mobile number. */
export function normalizePkPhone(input: string): string | null {
  const compact = input.trim().replace(/[\s\-().]/g, '');
  let digits: string;
  if (compact.startsWith('+')) {
    // "+" introduces a country code, so a local number after it ("+0300…", "+300…") is a typo.
    if (!compact.startsWith('+92')) return null;
    digits = compact.slice(1);
  } else if (compact.startsWith('0092')) digits = compact.slice(2);
  else digits = compact;

  if (!/^\d+$/.test(digits)) return null;

  let normalized: string | null = null;
  if (/^923\d{9}$/.test(digits)) normalized = `+${digits}`;
  else if (/^03\d{9}$/.test(digits)) normalized = `+92${digits.slice(1)}`;
  else if (/^3\d{9}$/.test(digits)) normalized = `+92${digits}`;

  return normalized && E164.test(normalized) ? normalized : null;
}

export function isPkMobile(input: string): boolean {
  return normalizePkPhone(input) !== null;
}

/** `+923001234567` → `"0300 1234567"` (how people in Pakistan write it). Other input is returned as is. */
export function formatPkPhone(phone: string): string {
  const normalized = normalizePkPhone(phone);
  if (!normalized) return phone;
  const local = `0${normalized.slice(3)}`;
  return `${local.slice(0, 4)} ${local.slice(4)}`;
}

/** Digits for wa.me links: `+923001234567` → `"923001234567"`. */
export function whatsappNumber(phone: string): string | null {
  const normalized = normalizePkPhone(phone);
  return normalized ? normalized.slice(1) : null;
}
