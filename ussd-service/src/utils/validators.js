/**
 * Phone validation & normalization for USSD.
 *
 * User-facing (menus / simulator SIM display): local 07XXXXXXXX
 * Under the hood (sessions, backend, DB): E.164 +2507XXXXXXXX
 */

/**
 * Validate phone number (accepts 07…, 2507…, +2507…)
 */
function isValidPhoneNumber(input) {
  const cleaned = input.trim().replace(/[\s-]+/g, '');

  if (/^07\d{8}$/.test(cleaned)) return true;
  if (/^2507\d{8}$/.test(cleaned)) return true;
  if (/^\+2507\d{8}$/.test(cleaned)) return true;

  return false;
}

/**
 * Normalize to international +2507XXXXXXXX for storage & API calls.
 */
function normalizePhoneNumber(input) {
  const cleaned = input.trim().replace(/[\s-]+/g, '');

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
 * Local display form 07XXXXXXXX (what users type / see on the handset).
 */
function formatPhoneForDisplay(input) {
  const e164 = normalizePhoneNumber(input);
  if (/^\+2507\d{8}$/.test(e164)) {
    return '0' + e164.slice(4);
  }
  return input;
}

/**
 * Validate PIN format (4 digits)
 */
function isValidPin(input) {
  return /^\d{4}$/.test(input.trim());
}

/**
 * Validate amount (positive number)
 */
function isValidAmount(input) {
  const num = parseFloat(input.trim());
  return !isNaN(num) && num > 0;
}

/**
 * Validate numeric menu choice within range
 */
function isValidChoice(input, min, max) {
  const num = parseInt(input.trim());
  return !isNaN(num) && num >= min && num <= max;
}

/**
 * Validate input is numeric
 */
function isNumeric(input) {
  return /^\d+$/.test(input.trim());
}

/**
 * Redact likely PIN segments from USSD accumulated text for logs
 */
function redactUssdText(text) {
  if (!text) return '';
  const parts = String(text).split('*');
  const redacted = parts.map((part) => (/^\d{4}$/.test(part) ? '****' : part));
  return redacted.join('*');
}

module.exports = {
  isValidPhoneNumber,
  normalizePhoneNumber,
  formatPhoneForDisplay,
  isValidPin,
  isValidAmount,
  isValidChoice,
  isNumeric,
  redactUssdText,
};
