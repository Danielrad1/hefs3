/**
 * Media file handling utilities
 * Provides canonical URI generation for consistent media access
 */

import * as FileSystem from 'expo-file-system/legacy';

export const MEDIA_DIR = `${FileSystem.documentDirectory}media/`;

/**
 * Get canonical media URI for a filename
 * 
 * CRITICAL: This is the ONLY way to build media file paths.
 * All media access must use this to ensure consistency.
 * 
 * @param filename - Original filename (NOT encoded)
 * @returns Full file:// URI with properly encoded filename
 */
export function getMediaUri(filename: string): string {
  // Always encode the filename to handle spaces and special characters
  // This is the canonical scheme used throughout the app
  return `${MEDIA_DIR}${encodeURIComponent(filename)}`;
}

/**
 * Sanitize filename to prevent path traversal attacks
 * while preserving the original characters for encoding
 * 
 * @param filename - Raw filename from user or import
 * @returns Safe filename (original chars preserved)
 */
export function sanitizeMediaFilename(filename: string): string {
  // Strip all path components - keep only the basename
  const basename = filename.split(/[/\\]/).pop() || '';
  
  // Remove path traversal attempts
  let sanitized = basename.replace(/\.\./g, '');
  
  // Final safety check: assert no path separators remain
  if (sanitized.includes('/') || sanitized.includes('\\')) {
    throw new Error(`Filename sanitization failed: path separators remain in "${sanitized}"`);
  }
  
  // Limit length to 200 chars to leave room for encoding expansion
  if (sanitized.length > 200) {
    const ext = sanitized.substring(sanitized.lastIndexOf('.'));
    const name = sanitized.substring(0, 200 - ext.length);
    sanitized = name + ext;
  }
  
  return sanitized;
}
