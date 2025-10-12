/**
 * MediaService Tests - Critical for hash fix validation
 */

import { MediaService } from '../MediaService';
import { InMemoryDb } from '../InMemoryDb';
import * as FileSystem from 'expo-file-system/legacy';
import * as Crypto from 'expo-crypto';

// Mock file system and crypto
jest.mock('expo-file-system/legacy');
jest.mock('expo-crypto');

describe('MediaService', () => {
  let db: InMemoryDb;
  let mediaService: MediaService;

  beforeEach(() => {
    db = new InMemoryDb();
    mediaService = new MediaService(db);
    jest.clearAllMocks();
  });

  describe('Hash Calculation', () => {
    it('should generate deterministic SHA-256 hashes', async () => {
      const mockFileContent = 'base64content';
      const mockHash = 'abc123def456';

      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(mockFileContent);
      (Crypto.digestStringAsync as jest.Mock).mockResolvedValue(mockHash);

      const hash1 = await (mediaService as any).calculateHash('file://test.jpg');
      const hash2 = await (mediaService as any).calculateHash('file://test.jpg');

      expect(hash1).toBe(hash2);
      expect(hash1).toBe(mockHash);
    });

    it('should use SHA-256 algorithm', async () => {
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('content');
      (Crypto.digestStringAsync as jest.Mock).mockResolvedValue('hash');

      await (mediaService as any).calculateHash('file://test.jpg');

      expect(Crypto.digestStringAsync).toHaveBeenCalledWith(
        Crypto.CryptoDigestAlgorithm.SHA256,
        'content',
        { encoding: Crypto.CryptoEncoding.HEX }
      );
    });

  });

  describe('Edge Cases', () => {
    it('should handle empty filename', async () => {
      const result = await mediaService.registerExistingMedia('');
      expect(result).toBeNull();
    });

    it('should store different files separately', async () => {
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('content');
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: true,
        size: 1024,
      });
      (FileSystem.copyAsync as jest.Mock).mockResolvedValue(undefined);

      // Different hashes for different files
      (Crypto.digestStringAsync as jest.Mock)
        .mockResolvedValueOnce('hash-1')
        .mockResolvedValueOnce('hash-2');

      const media1 = await mediaService.addMediaFile('file://image1.jpg', 'image1.jpg');
      const media2 = await mediaService.addMediaFile('file://image2.jpg', 'image2.jpg');

      expect(media1.id).not.toBe(media2.id);
      expect(media1.hash).not.toBe(media2.hash);
      expect(FileSystem.copyAsync).toHaveBeenCalledTimes(2);
    });
  });

  describe('Garbage Collection', () => {
    it('should delete orphaned media files', async () => {
      // Create media
      const media = {
        id: '1',
        filename: 'orphan.jpg',
        hash: 'hash123',
        mime: 'image/jpeg',
        size: 1024,
        localUri: 'file://orphan.jpg',
        created: 123456,
      };
      db.addMedia(media);

      // No notes reference this media
      (FileSystem.deleteAsync as jest.Mock).mockResolvedValue(undefined);

      const deletedCount = await mediaService.gcUnused();

      expect(deletedCount).toBe(1);
      expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
        media.localUri,
        { idempotent: true }
      );
    });

    it('should preserve media referenced in notes', async () => {
      // Create media
      const media = {
        id: '1',
        filename: 'used.jpg',
        hash: 'hash123',
        mime: 'image/jpeg',
        size: 1024,
        localUri: 'file://used.jpg',
        created: 123456,
      };
      db.addMedia(media);

      // Create note that references this media
      db.addNote({
        id: 'note1',
        guid: 'guid1',
        mid: 1,
        mod: 123456,
        usn: -1,
        tags: ' ',
        flds: '<img src="used.jpg">',
        sfld: 0,
        csum: 12345,
        flags: 0,
        data: '',
      });

      const deletedCount = await mediaService.gcUnused();

      expect(deletedCount).toBe(0);
      expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
    });

    it('should handle audio references in notes', async () => {
      const media = {
        id: '1',
        filename: 'audio.mp3',
        hash: 'hash123',
        mime: 'audio/mpeg',
        size: 2048,
        localUri: 'file://audio.mp3',
        created: 123456,
      };
      db.addMedia(media);

      db.addNote({
        id: 'note1',
        guid: 'guid1',
        mid: 1,
        mod: 123456,
        usn: -1,
        tags: ' ',
        flds: '[sound:audio.mp3]',
        sfld: 0,
        csum: 12345,
        flags: 0,
        data: '',
      });

      const deletedCount = await mediaService.gcUnused();

      expect(deletedCount).toBe(0);
    });
  });

  describe('Filename Sanitization', () => {
    it('should sanitize unsafe filenames', () => {
      const unsafe = '../../../etc/passwd';
      const sanitized = (mediaService as any).sanitizeFilename(unsafe);

      expect(sanitized).not.toContain('/');
      expect(sanitized).not.toContain('\\');
      expect(sanitized).not.toContain('..');
    });

    it('should preserve safe filenames', () => {
      const safe = 'my-image_123.jpg';
      const sanitized = (mediaService as any).sanitizeFilename(safe);

      expect(sanitized).toBe(safe);
    });

    it('should handle empty filenames', () => {
      const empty = '';
      const sanitized = (mediaService as any).sanitizeFilename(empty);

      expect(sanitized).toMatch(/^file_\d+$/);
    });
  });
});
