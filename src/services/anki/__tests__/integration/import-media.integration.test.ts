/**
 * Import Media Integration Test
 * Tests: Import .apkg → Extract Media → Calculate Hash → Deduplicate
 */

import { InMemoryDb } from '../../InMemoryDb';
import { MediaService } from '../../MediaService';
import { NoteService } from '../../NoteService';
import * as FileSystem from 'expo-file-system/legacy';
import * as Crypto from 'expo-crypto';

describe('Import Media Integration', () => {
  let db: InMemoryDb;
  let mediaService: MediaService;
  let noteService: NoteService;

  beforeEach(() => {
    db = new InMemoryDb();
    mediaService = new MediaService(db);
    noteService = new NoteService(db);
    jest.clearAllMocks();
  });

  describe('Media Import and Deduplication', () => {
    it('should import media with real hash calculation', async () => {
      const mockHash = 'abc123def456';
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('file-content');
      (Crypto.digestStringAsync as jest.Mock).mockResolvedValue(mockHash);
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: true,
        size: 1024,
      });
      (FileSystem.copyAsync as jest.Mock).mockResolvedValue(undefined);

      const media = await mediaService.importMedia('image.jpg', 'file://source/image.jpg');

      expect(media.hash).toBe(mockHash);
      expect(media.filename).toBe('image.jpg');
      expect(Crypto.digestStringAsync).toHaveBeenCalledWith(
        Crypto.CryptoDigestAlgorithm.SHA256,
        'file-content',
        { encoding: Crypto.CryptoEncoding.HEX }
      );
    });

    it('should deduplicate identical media files during import', async () => {
      const sameHash = 'duplicate-hash-123';
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('same-content');
      (Crypto.digestStringAsync as jest.Mock).mockResolvedValue(sameHash);
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: true,
        size: 2048,
      });
      (FileSystem.copyAsync as jest.Mock).mockResolvedValue(undefined);

      // Import first file
      const media1 = await mediaService.importMedia('photo1.jpg', 'file://source/photo1.jpg');
      expect(media1.hash).toBe(sameHash);
      expect(FileSystem.copyAsync).toHaveBeenCalledTimes(1);

      // Import second file with same content (different filename)
      const media2 = await mediaService.importMedia('photo2.jpg', 'file://source/photo2.jpg');
      
      // Should return same media object (deduplicated)
      expect(media2.id).toBe(media1.id);
      expect(media2.hash).toBe(sameHash);
      // File copy should only happen once (first import)
      expect(FileSystem.copyAsync).toHaveBeenCalledTimes(1);
    });

    it('should store different media files separately', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: true,
        size: 1024,
      });
      (FileSystem.copyAsync as jest.Mock).mockResolvedValue(undefined);

      // Mock different hashes for different files
      (FileSystem.readAsStringAsync as jest.Mock)
        .mockResolvedValueOnce('content-1')
        .mockResolvedValueOnce('content-2');
      
      (Crypto.digestStringAsync as jest.Mock)
        .mockResolvedValueOnce('hash-aaa')
        .mockResolvedValueOnce('hash-bbb');

      const media1 = await mediaService.importMedia('unique1.jpg', 'file://source/unique1.jpg');
      const media2 = await mediaService.importMedia('unique2.jpg', 'file://source/unique2.jpg');

      expect(media1.id).not.toBe(media2.id);
      expect(media1.hash).not.toBe(media2.hash);
      expect(FileSystem.copyAsync).toHaveBeenCalledTimes(2);
    });
  });

  describe('Batch Media Registration', () => {
    it('should register multiple media files efficiently', async () => {
      const filenames = ['img1.jpg', 'img2.jpg', 'img3.jpg'];
      
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: true,
        size: 1024,
      });
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('content');
      (Crypto.digestStringAsync as jest.Mock)
        .mockResolvedValueOnce('hash1')
        .mockResolvedValueOnce('hash2')
        .mockResolvedValueOnce('hash3');

      const results = await mediaService.batchRegisterExistingMedia(filenames);

      expect(results.size).toBe(3);
      expect(results.get('img1.jpg')).toBeDefined();
      expect(results.get('img2.jpg')).toBeDefined();
      expect(results.get('img3.jpg')).toBeDefined();
    });

    it('should handle progress callback during batch registration', async () => {
      const filenames = Array.from({ length: 10 }, (_, i) => `img${i}.jpg`);
      const progressUpdates: Array<{ current: number; total: number }> = [];
      
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: true,
        size: 1024,
      });
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('content');
      (Crypto.digestStringAsync as jest.Mock).mockResolvedValue('hash');

      await mediaService.batchRegisterExistingMedia(
        filenames,
        (current, total) => {
          progressUpdates.push({ current, total });
        }
      );

      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[progressUpdates.length - 1].current).toBe(10);
      expect(progressUpdates[progressUpdates.length - 1].total).toBe(10);
    });

    it('should skip already registered media in batch', async () => {
      const filenames = ['existing.jpg', 'new.jpg'];
      
      // Pre-register first file
      db.addMedia({
        id: 'media1',
        filename: 'existing.jpg',
        hash: 'hash1',
        mime: 'image/jpeg',
        size: 1024,
        localUri: 'file://existing.jpg',
        created: 123456,
      });

      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: true,
        size: 1024,
      });
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('content');
      (Crypto.digestStringAsync as jest.Mock).mockResolvedValue('hash2');

      const results = await mediaService.batchRegisterExistingMedia(filenames);

      // existing.jpg should be found in DB, not re-registered
      expect(results.get('existing.jpg')?.id).toBe('media1');
      // new.jpg should be newly registered
      expect(results.get('new.jpg')).toBeDefined();
      expect(results.get('new.jpg')?.id).not.toBe('media1');
    });
  });

  describe('Media References in Notes', () => {
    it('should import note with media and link them correctly', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: true,
        size: 1024,
      });
      (FileSystem.copyAsync as jest.Mock).mockResolvedValue(undefined);
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('content');
      (Crypto.digestStringAsync as jest.Mock).mockResolvedValue('media-hash');

      // Import media
      const media = await mediaService.importMedia('vocab.jpg', 'file://source/vocab.jpg');
      
      // Create note referencing the media
      const note = noteService.createNote({
        modelId: 1,
        deckId: '1',
        fields: [`<img src="${media.filename}">`, 'Definition'],
      });

      // Verify media is referenced
      expect(note.flds).toContain(media.filename);
      
      // Media should not be orphaned
      const allMedia = db.getAllMedia();
      expect(allMedia.length).toBe(1);
      
      // If we run GC, media should be preserved
      const deletedCount = await mediaService.gcUnused();
      expect(deletedCount).toBe(0);
    });

    it('should handle multiple media references in single note', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: true,
        size: 1024,
      });
      (FileSystem.copyAsync as jest.Mock).mockResolvedValue(undefined);
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('content');
      (Crypto.digestStringAsync as jest.Mock)
        .mockResolvedValueOnce('hash1')
        .mockResolvedValueOnce('hash2');

      // Import two media files
      const image = await mediaService.importMedia('image.jpg', 'file://source/image.jpg');
      const audio = await mediaService.importMedia('audio.mp3', 'file://source/audio.mp3');
      
      // Create note with both media
      const note = noteService.createNote({
        modelId: 1,
        deckId: '1',
        fields: [
          `<img src="${image.filename}"> [sound:${audio.filename}]`,
          'Back'
        ],
      });

      expect(note.flds).toContain(image.filename);
      expect(note.flds).toContain(audio.filename);
      
      // Both media should be preserved by GC
      const deletedCount = await mediaService.gcUnused();
      expect(deletedCount).toBe(0);
    });
  });

  describe('Hash Collision Handling', () => {
    it('should detect and handle identical file content', async () => {
      const identicalContent = 'exactly-the-same-bytes';
      const identicalHash = 'collision-hash';
      
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(identicalContent);
      (Crypto.digestStringAsync as jest.Mock).mockResolvedValue(identicalHash);
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: true,
        size: 512,
      });
      (FileSystem.copyAsync as jest.Mock).mockResolvedValue(undefined);

      // Import same content with different filenames
      const media1 = await mediaService.importMedia('copy1.jpg', 'file://copy1.jpg');
      const media2 = await mediaService.importMedia('copy2.jpg', 'file://copy2.jpg');
      const media3 = await mediaService.importMedia('copy3.jpg', 'file://copy3.jpg');

      // All should point to same media entry (deduplicated)
      expect(media1.id).toBe(media2.id);
      expect(media2.id).toBe(media3.id);
      expect(media1.hash).toBe(identicalHash);
      
      // Only one file should exist in DB
      expect(db.getAllMedia().length).toBe(1);
      // File only copied once
      expect(FileSystem.copyAsync).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Scenarios', () => {
    it('should handle hash calculation failure gracefully', async () => {
      (FileSystem.readAsStringAsync as jest.Mock).mockRejectedValue(
        new Error('File read failed')
      );
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: true,
        size: 1024,
        modificationTime: 1234567890,
      });
      (FileSystem.copyAsync as jest.Mock).mockResolvedValue(undefined);

      // Should fall back to file info hash
      const media = await mediaService.importMedia('problem.jpg', 'file://problem.jpg');
      
      expect(media.hash).toContain('fallback');
      expect(media.hash).toContain('1024'); // Size in fallback
    });

    it('should handle missing source file', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: false,
      });

      const result = await mediaService.registerExistingMedia('missing.jpg');
      expect(result).toBeNull();
    });
  });

  describe('Batch Processing', () => {
    it('should process batch registration successfully', async () => {
      const filenames = Array.from({ length: 100 }, (_, i) => `img${i}.jpg`);
      
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: true,
        size: 1024,
      });
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('content');
      (Crypto.digestStringAsync as jest.Mock).mockResolvedValue('hash');

      await mediaService.batchRegisterExistingMedia(filenames);

      // Verify all files were registered
      expect(db.getAllMedia().length).toBe(100);
      
      // Verify hash calculation was called for each file
      expect(Crypto.digestStringAsync).toHaveBeenCalledTimes(100);
    });
  });
});
