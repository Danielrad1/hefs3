/**
 * Test suite for UnzipStrategy
 * Tests missing collection.anki2 error and large file guard
 */

import { UnzipStrategy } from '../UnzipStrategy';
import * as FileSystem from 'expo-file-system/legacy';

// Mock logger
jest.mock('../../../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('UnzipStrategy', () => {
  const tempDir = 'file://mock/temp/';
  let strategy: UnzipStrategy;

  beforeEach(() => {
    strategy = new UnzipStrategy(tempDir);
  });

  describe('extractCollectionFromZip', () => {
    it('throws meaningful error when no collection file exists', async () => {
      const mockZip = {
        file: jest.fn((filename: string) => {
          // Neither collection.anki21 nor collection.anki2 exists
          return null;
        }),
      };

      await expect(strategy.extractCollectionFromZip(mockZip)).rejects.toThrow(
        'No collection file found in .apkg'
      );
    });

    it('uses collection.anki21 when available', async () => {
      const mockCollectionFile = {
        async: jest.fn().mockResolvedValue('base64data'),
      };

      const mockZip = {
        file: jest.fn((filename: string) => {
          if (filename === 'collection.anki21') return mockCollectionFile;
          return null;
        }),
      };

      (FileSystem.writeAsStringAsync as jest.Mock).mockResolvedValue(undefined);
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });

      await strategy.extractCollectionFromZip(mockZip);

      expect(mockZip.file).toHaveBeenCalledWith('collection.anki21');
      expect(mockCollectionFile.async).toHaveBeenCalledWith('base64');
    });

    it('falls back to collection.anki2 when anki21 not found', async () => {
      const mockCollectionFile = {
        async: jest.fn().mockResolvedValue('base64data'),
      };

      const mockZip = {
        file: jest.fn((filename: string) => {
          if (filename === 'collection.anki21') return null;
          if (filename === 'collection.anki2') return mockCollectionFile;
          return null;
        }),
      };

      (FileSystem.writeAsStringAsync as jest.Mock).mockResolvedValue(undefined);
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });

      await strategy.extractCollectionFromZip(mockZip);

      expect(mockZip.file).toHaveBeenCalledWith('collection.anki21');
      expect(mockZip.file).toHaveBeenCalledWith('collection.anki2');
      expect(mockCollectionFile.async).toHaveBeenCalledWith('base64');
    });

    it('writes collection to temp directory with base64 encoding', async () => {
      const mockData = 'mock-base64-data';
      const mockCollectionFile = {
        async: jest.fn().mockResolvedValue(mockData),
      };

      const mockZip = {
        file: jest.fn().mockReturnValue(mockCollectionFile),
      };

      (FileSystem.writeAsStringAsync as jest.Mock).mockResolvedValue(undefined);
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });

      const result = await strategy.extractCollectionFromZip(mockZip);

      expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
        expect.stringContaining('collection.anki2'),
        mockData,
        { encoding: FileSystem.EncodingType.Base64 }
      );
      expect(result).toContain('collection.anki2');
    });
  });

  describe('readLargeFileAsZip (via readAndUnzipWithJSZip)', () => {
    it('throws user-friendly message for files exceeding string length limit', async () => {
      const fileUri = 'file://mock/large.apkg';
      const fileSizeMB = 150;

      // Mock fetch to fail with string length error
      global.fetch = jest.fn().mockRejectedValue(
        new Error('Maximum string length exceeded')
      );

      // Mock FileSystem to also fail with string length error
      (FileSystem.readAsStringAsync as jest.Mock).mockRejectedValue(
        new RangeError('String length limit exceeded')
      );

      await expect(strategy.readAndUnzipWithJSZip(fileUri, fileSizeMB)).rejects.toThrow(
        /File too large to process/
      );
      
      // Also check it includes the helpful message
      try {
        await strategy.readAndUnzipWithJSZip(fileUri, fileSizeMB);
        fail('Should have thrown');
      } catch (error: any) {
        expect(error.message).toContain('fundamental limitation');
      }
    });

    it('includes helpful solutions in large file error message', async () => {
      const fileUri = 'file://mock/large.apkg';
      const fileSizeMB = 200;

      global.fetch = jest.fn().mockRejectedValue(
        new RangeError('String length')
      );

      (FileSystem.readAsStringAsync as jest.Mock).mockRejectedValue(
        new Error('String length exceeded')
      );

      try {
        await strategy.readAndUnzipWithJSZip(fileUri, fileSizeMB);
        fail('Should have thrown');
      } catch (error: any) {
        expect(error.message).toContain('Split your deck into smaller files');
        expect(error.message).toContain('<100MB');
      }
    });

    it('attempts ArrayBuffer path before base64 fallback', async () => {
      const fileUri = 'file://mock/medium.apkg';
      const fileSizeMB = 50;

      // Clear previous mock calls
      jest.clearAllMocks();

      const mockArrayBuffer = new ArrayBuffer(1024);
      const mockBlob = {
        arrayBuffer: jest.fn().mockResolvedValue(mockArrayBuffer),
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        blob: jest.fn().mockResolvedValue(mockBlob),
      } as any);

      const JSZip = require('jszip');
      JSZip.loadAsync = jest.fn().mockResolvedValue({ files: {} });

      await strategy.readAndUnzipWithJSZip(fileUri, fileSizeMB);

      expect(mockBlob.arrayBuffer).toHaveBeenCalled();
      expect(FileSystem.readAsStringAsync).not.toHaveBeenCalled();
    });
  });

  describe('tryStreamingUnzip', () => {
    it('creates extraction directory', async () => {
      const fileUri = 'file://mock/test.apkg';

      // Mock no streaming libraries available
      (FileSystem.makeDirectoryAsync as jest.Mock).mockResolvedValue(undefined);
      (FileSystem.deleteAsync as jest.Mock).mockResolvedValue(undefined);

      await strategy.tryStreamingUnzip(fileUri);

      expect(FileSystem.makeDirectoryAsync).toHaveBeenCalledWith(
        expect.stringContaining('unzipped_'),
        { intermediates: true }
      );
    });

    it('returns null when no streaming library is available', async () => {
      const fileUri = 'file://mock/test.apkg';

      (FileSystem.makeDirectoryAsync as jest.Mock).mockResolvedValue(undefined);
      (FileSystem.deleteAsync as jest.Mock).mockResolvedValue(undefined);

      const result = await strategy.tryStreamingUnzip(fileUri);

      expect(result).toBeNull();
    });

    it('cleans up directory when streaming fails', async () => {
      const fileUri = 'file://mock/test.apkg';

      (FileSystem.makeDirectoryAsync as jest.Mock).mockResolvedValue(undefined);
      (FileSystem.deleteAsync as jest.Mock).mockResolvedValue(undefined);

      await strategy.tryStreamingUnzip(fileUri);

      expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
        expect.stringContaining('unzipped_'),
        { idempotent: true }
      );
    });
  });
});
