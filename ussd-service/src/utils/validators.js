/**
 * Input validation utilities for USSD screens
 * Project standard phone format: local Rwanda MSISDN 07XXXXXXXX (e.g. 0788123456)
 */

/**
 * Validate phone number format (accepts 07…, 2507…, +2507…; stored/used as 07…)
 */
function isValidPhoneNumber(input) {
  const cleaned = input.trim().replace(/[\s-]+/g, '');

  if (/^07\d{8}$/.test(cleaned)) return true;
  if (/^2507\d{8}$/.test(cleaned)) return true;
  if (/^\+2507\d{8}$/.test(cleaned)) return true;

  return false;
}

/**
 * Normalize to local 07XXXXXXXX (not +250…)
 */
function normalizePhoneNumber(input) {
  const cleaned = input.trim().replace(/[\s-]+/g, '');

  if (/^07\d{8}$/.test(cleaned)) {
    return cleaned;
  }

  if (/^\+2507\d{8}$/.test(cleaned)) {
    return '0' + cleaned.slice(4);
  }

  if (/^2507\d{8}$/.test(cleaned)) {
    return '0' + cleaned.slice(3);
  }

  return cleaned;
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
  isValidPin,
  isValidAmount,
  isValidChoice,
  isNumeric,
  redactUssdText,
};
