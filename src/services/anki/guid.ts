/**
 * GUID Generation for Anki compatibility
 * Anki uses base91-encoded GUIDs for note identification
 */

/**
 * Base91 alphabet used by Anki
 */
const BASE91_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#$%&()*+,./:;<=>?@[]^_`{|}~';

/**
 * Generate a random 64-bit integer as a string
 */
function generateRandomInt64(): string {
  // Generate two 32-bit numbers and combine them
  const high = Math.floor(Math.random() * 0x100000000);
  const low = Math.floor(Math.random() * 0x100000000);
  
  // Combine into 64-bit number
  const combined = high * 0x100000000 + low;
  return combined.toString();
}

/**
 * Encode a number to base91 (Anki's format)
 */
function encodeBase91(num: number): string {
  if (num === 0) return BASE91_ALPHABET[0];
  
  let result = '';
  while (num > 0) {
    result = BASE91_ALPHABET[num % 91] + result;
    num = Math.floor(num / 91);
  }
  return result;
}

/**
 * Generate an Anki-compatible GUID
 * Returns a base91-encoded string similar to Anki's format
 */
export function generateGuid(): string {
  // Generate a random number and encode it
  const randomNum = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
  return encodeBase91(randomNum);
}

/**
 * Alternative GUID generation using timestamp + random
 * This ensures uniqueness better than pure random
 */
export function generateTimestampGuid(): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 0xFFFFFF);
  const combined = timestamp * 0x1000000 + random;
  return encodeBase91(combined);
}
