/**
 * Checksum calculation for Anki compatibility
 * Anki uses SHA1-based checksums for note field content
 */

/**
 * Simple hash function for checksum calculation
 * This is a JavaScript implementation similar to Anki's checksum logic
 */
function simpleHash(str: string): number {
  let hash = 0;
  if (str.length === 0) return hash;
  
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return Math.abs(hash);
}

/**
 * Calculate checksum for Anki note field
 * This is used for the 'csum' field in AnkiNote
 * 
 * @param fieldContent The content of the field to checksum (usually the sort field)
 * @returns A numeric checksum
 */
export function calculateChecksum(fieldContent: string): number {
  // Strip HTML tags and normalize whitespace like Anki does
  const cleanContent = fieldContent
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/\s+/g, ' ')    // Normalize whitespace
    .trim()
    .toLowerCase();
  
  return simpleHash(cleanContent);
}

/**
 * Alternative checksum using a more sophisticated algorithm
 * This provides better distribution for collision avoidance
 */
export function calculateAdvancedChecksum(fieldContent: string): number {
  const cleanContent = fieldContent
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  
  let hash = 5381; // DJB2 hash algorithm
  
  for (let i = 0; i < cleanContent.length; i++) {
    hash = ((hash << 5) + hash) + cleanContent.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return Math.abs(hash);
}
