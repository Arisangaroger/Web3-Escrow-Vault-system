/**
 * Input validation utilities for USSD screens
 */

/**
 * Validate phone number format
 */
function isValidPhoneNumber(input) {
  // Accept formats: +250788123456, 250788123456, 0788123456
  const cleaned = input.trim().replace(/\s+/g, '');
  
  // International format with +
  if (/^\+\d{10,15}$/.test(cleaned)) return true;
  
  // Country code without +
  if (/^250\d{9}$/.test(cleaned)) return true;
  
  // Local format starting with 0
  if (/^0\d{9}$/.test(cleaned)) return true;
  
  return false;
}

/**
 * Normalize phone number to E.164 format (+250788123456)
 */
function normalizePhoneNumber(input) {
  const cleaned = input.trim().replace(/\s+/g, '');
  
  // Already in international format
  if (cleaned.startsWith('+250')) {
    return cleaned;
  }
  
  // Country code without +
  if (cleaned.startsWith('250')) {
    return '+' + cleaned;
  }
  
  // Local format (07...)
  if (cleaned.startsWith('0')) {
    return '+250' + cleaned.substring(1);
  }
  
  return input; // Return as-is if can't normalize
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

module.exports = {
  isValidPhoneNumber,
  normalizePhoneNumber,
  isValidPin,
  isValidAmount,
  isValidChoice,
  isNumeric,
};
