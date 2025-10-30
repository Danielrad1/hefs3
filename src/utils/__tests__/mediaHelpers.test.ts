/**
 * Test suite for media file handling utilities
 * Tests URI generation, filename sanitization, and path traversal prevention
 */

import { getMediaUri, sanitizeMediaFilename, MEDIA_DIR } from '../mediaHelpers';

describe('mediaHelpers', () => {
  describe('getMediaUri', () => {
    it('percent-encodes filename with spaces', () => {
      const uri = getMediaUri('my file.jpg');
      expect(uri).toBe(`${MEDIA_DIR}my%20file.jpg`);
    });

    it('percent-encodes special characters', () => {
      const uri = getMediaUri('file (1).jpg');
      expect(uri).toBe(`${MEDIA_DIR}file%20(1).jpg`);
    });

    it('handles unicode characters', () => {
      const uri = getMediaUri('文件.jpg');
      expect(uri).toBe(`${MEDIA_DIR}%E6%96%87%E4%BB%B6.jpg`);
    });

    it('does not encode directory part', () => {
      // The MEDIA_DIR should remain unencoded
      expect(getMediaUri('file.jpg')).toContain('file://');
    });
  });

  describe('sanitizeMediaFilename', () => {
    it('strips forward slash path separators', () => {
      const sanitized = sanitizeMediaFilename('path/to/file.jpg');
      expect(sanitized).toBe('file.jpg');
    });

    it('strips backslash path separators', () => {
      const sanitized = sanitizeMediaFilename('path\\to\\file.jpg');
      expect(sanitized).toBe('file.jpg');
    });

    it('strips mixed path separators', () => {
      const sanitized = sanitizeMediaFilename('path/to\\mixed/file.jpg');
      expect(sanitized).toBe('file.jpg');
    });

    it('removes path traversal attempts', () => {
      const sanitized = sanitizeMediaFilename('../../etc/passwd');
      expect(sanitized).toBe('passwd'); // Splits by / and takes last component
    });

    it('handles complex traversal with mixed separators', () => {
      const sanitized = sanitizeMediaFilename('..\\..//bad/..//file.jpg');
      expect(sanitized).toBe('file.jpg');
    });

    it('ensures no path separators remain after sanitization', () => {
      // Verifies the safety check - separators are stripped at multiple stages
      const result = sanitizeMediaFilename('normalfile.jpg');
      expect(result).not.toContain('/');
      expect(result).not.toContain('\\');
    });

    it('limits length to 200 chars while preserving extension', () => {
      const longName = 'a'.repeat(250) + '.jpg';
      const sanitized = sanitizeMediaFilename(longName);
      
      expect(sanitized.length).toBeLessThanOrEqual(200);
      expect(sanitized.endsWith('.jpg')).toBe(true);
      expect(sanitized).toMatch(/^a+\.jpg$/);
    });

    it('handles long names without extension', () => {
      const longName = 'a'.repeat(250);
      const sanitized = sanitizeMediaFilename(longName);
      
      expect(sanitized.length).toBeLessThanOrEqual(200);
    });

    it('preserves extension in length limit', () => {
      const longName = 'a'.repeat(250) + '.verylongextension';
      const sanitized = sanitizeMediaFilename(longName);
      
      expect(sanitized.length).toBeLessThanOrEqual(200);
      expect(sanitized.endsWith('.verylongextension')).toBe(true);
    });

    it('handles empty filename after sanitization', () => {
      const sanitized = sanitizeMediaFilename('../..');
      expect(sanitized).toBe('');
    });

    it('preserves valid simple filenames', () => {
      const sanitized = sanitizeMediaFilename('image.png');
      expect(sanitized).toBe('image.png');
    });

    it('handles multiple dots in filename', () => {
      const sanitized = sanitizeMediaFilename('file.backup.tar.gz');
      expect(sanitized).toBe('file.backup.tar.gz');
    });

    it('handles filename with no extension', () => {
      const sanitized = sanitizeMediaFilename('README');
      expect(sanitized).toBe('README');
    });
  });

  describe('integration: getMediaUri with sanitizeMediaFilename', () => {
    it('combines sanitization and URI generation correctly', () => {
      const dangerous = '../../../etc/passwd file (1).txt';
      const sanitized = sanitizeMediaFilename(dangerous);
      const uri = getMediaUri(sanitized);
      
      expect(uri).toBe(`${MEDIA_DIR}passwd%20file%20(1).txt`); // Path components stripped, only basename remains
    });

    it('handles complete workflow with spaces and paths', () => {
      const input = 'folder/My Document (2023).pdf';
      const sanitized = sanitizeMediaFilename(input);
      const uri = getMediaUri(sanitized);
      
      expect(uri).toBe(`${MEDIA_DIR}My%20Document%20(2023).pdf`);
    });
  });
});
