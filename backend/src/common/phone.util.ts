/**
 * Rwanda phone numbers:
 * - User-facing / USSD keypad style: 07XXXXXXXX
 * - Canonical storage & lookups: +2507XXXXXXXX
 */

export function isValidRwandaPhone(input: string): boolean {
  const cleaned = String(input || '')
    .trim()
    .replace(/[\s-]+/g, '');
  return (
    /^07\d{8}$/.test(cleaned) ||
    /^2507\d{8}$/.test(cleaned) ||
    /^\+2507\d{8}$/.test(cleaned)
  );
}

/**
 * Normalize to E.164 +2507XXXXXXXX
 */
export function normalizePhoneNumber(input: string): string {
  const cleaned = String(input || '')
    .trim()
    .replace(/[\s-]+/g, '');

  if (/^07\d{8}$/.test(cleaned)) {
    return '+250' + cleaned.slice(1);
  }
  if (/^\+2507\d{8}$/.test(cleaned)) {
    return cleaned;
  }
  if (/^2507\d{8}$/.test(cleaned)) {
    return '+' + cleaned;
  }
  return cleaned;
}

/**
 * Local display 07XXXXXXXX
 */
export function formatPhoneForDisplay(input: string): string {
  const e164 = normalizePhoneNumber(input);
  if (/^\+2507\d{8}$/.test(e164)) {
    return '0' + e164.slice(4);
  }
  return input;
}
