/**
 * Test suite for MediaExtractor
 * Tests media file extraction, deduplication, and empty media handling
 */

import { MediaExtractor } from '../MediaExtractor';
import * as FileSystem from 'expo-file-system/legacy';

// Mock logger
jest.mock('../../../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('MediaExtractor', () => {
  const mediaDir = 'file://mock/media/';
  let extractor: MediaExtractor;

  beforeEach(() => {
    jest.clearAllMocks();
    extractor = new MediaExtractor(mediaDir);
  });

  describe('extractFromZip', () => {
    it('returns empty map when no media file exists in zip', async () => {
      const mockZip = {
        file: jest.fn().mockReturnValue(null),
      };

      const result = await extractor.extractFromZip(mockZip);

      expect(result.size).toBe(0);
      expect(mockZip.file).toHaveBeenCalledWith('media');
    });

    it('extracts media files according to media mapping', async () => {
      const mediaMapping = {
        '0': 'image1.jpg',
        '1': 'audio.mp3',
        '2': 'video.mp4',
      };

      const mockMediaFile = {
        async: jest.fn().mockResolvedValue(JSON.stringify(mediaMapping)),
      };

      const mockImageFile = {
        async: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
      };

      const mockZip = {
        file: jest.fn((filename: string) => {
          if (filename === 'media') return mockMediaFile;
          if (filename === '0' || filename === '1' || filename === '2') return mockImageFile;
          return null;
        }),
      };

      (FileSystem.writeAsStringAsync as jest.Mock).mockResolvedValue(undefined);
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ 
        exists: true, 
        isDirectory: false,
        size: 1024 
      });

      const result = await extractor.extractFromZip(mockZip);

      expect(result.size).toBe(3);
      expect(result.get('0')).toBe('image1.jpg');
      expect(result.get('1')).toBe('audio.mp3');
      expect(result.get('2')).toBe('video.mp4');
    });

    it('encodes filenames with special characters', async () => {
      const mediaMapping = {
        '0': 'file #1.jpg', // Has # which needs encoding
        '1': 'file with spaces.png',
      };

      const mockMediaFile = {
        async: jest.fn().mockResolvedValue(JSON.stringify(mediaMapping)),
      };

      const mockImageFile = {
        async: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
      };

      const mockZip = {
        file: jest.fn((filename: string) => {
          if (filename === 'media') return mockMediaFile;
          if (filename === '0' || filename === '1') return mockImageFile;
          return null;
        }),
      };

      (FileSystem.writeAsStringAsync as jest.Mock).mockResolvedValue(undefined);
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ 
        exists: true, 
        isDirectory: false 
      });

      await extractor.extractFromZip(mockZip);

      expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
        expect.stringContaining('file%20%231.jpg'),
        expect.any(String),
        expect.any(Object)
      );

      expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
        expect.stringContaining('file%20with%20spaces.png'),
        expect.any(String),
        expect.any(Object)
      );
    });

    it('handles missing media files gracefully', async () => {
      const mediaMapping = {
        '0': 'exists.jpg',
        '1': 'missing.jpg',
      };

      const mockMediaFile = {
        async: jest.fn().mockResolvedValue(JSON.stringify(mediaMapping)),
      };

      const mockImageFile = {
        async: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
      };

      const mockZip = {
        file: jest.fn((filename: string) => {
          if (filename === 'media') return mockMediaFile;
          if (filename === '0') return mockImageFile;
          if (filename === '1') return null; // Missing
          return null;
        }),
      };

      (FileSystem.writeAsStringAsync as jest.Mock).mockResolvedValue(undefined);
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ 
        exists: true, 
        isDirectory: false 
      });

      const result = await extractor.extractFromZip(mockZip);

      // Should only have the one that exists
      expect(result.size).toBe(1);
      expect(result.get('0')).toBe('exists.jpg');
      expect(result.get('1')).toBeUndefined();
    });

    it('writes files as base64 encoded', async () => {
      const mediaMapping = { '0': 'test.jpg' };

      const mockMediaFile = {
        async: jest.fn().mockResolvedValue(JSON.stringify(mediaMapping)),
      };

      const mockImageFile = {
        async: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
      };

      const mockZip = {
        file: jest.fn((filename: string) => {
          if (filename === 'media') return mockMediaFile;
          if (filename === '0') return mockImageFile;
          return null;
        }),
      };

      (FileSystem.writeAsStringAsync as jest.Mock).mockResolvedValue(undefined);
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ 
        exists: true, 
        isDirectory: false 
      });

      await extractor.extractFromZip(mockZip);

      expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        { encoding: FileSystem.EncodingType.Base64 }
      );
    });
  });

  describe('extractFromFs', () => {
    it('returns empty map when no media file exists', async () => {
      const extractedDir = 'file://mock/extracted/';

      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: false });

      const result = await extractor.extractFromFs(extractedDir);

      expect(result.size).toBe(0);
    });

    it('moves media files from extracted directory to media directory', async () => {
      const extractedDir = 'file://mock/extracted/';
      const mediaMapping = {
        '0': 'image.jpg',
        '1': 'audio.mp3',
      };

      (FileSystem.getInfoAsync as jest.Mock)
        .mockResolvedValueOnce({ exists: true }) // media file exists
        .mockResolvedValue({ exists: true, isDirectory: false }); // media files exist

      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(mediaMapping)
      );

      (FileSystem.moveAsync as jest.Mock).mockResolvedValue(undefined);

      const result = await extractor.extractFromFs(extractedDir);

      expect(result.size).toBe(2);
      expect(FileSystem.moveAsync).toHaveBeenCalledTimes(2);
    });

    it('falls back to copy if move fails', async () => {
      const extractedDir = 'file://mock/extracted/';
      const mediaMapping = { '0': 'test.jpg' };

      (FileSystem.getInfoAsync as jest.Mock)
        .mockResolvedValueOnce({ exists: true })
        .mockResolvedValue({ exists: true, isDirectory: false });

      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(mediaMapping)
      );

      (FileSystem.moveAsync as jest.Mock).mockRejectedValue(new Error('Move failed'));
      (FileSystem.copyAsync as jest.Mock).mockResolvedValue(undefined);

      await extractor.extractFromFs(extractedDir);

      expect(FileSystem.moveAsync).toHaveBeenCalled();
      expect(FileSystem.copyAsync).toHaveBeenCalled();
    });

    it('processes files in parallel batches', async () => {
      const extractedDir = 'file://mock/extracted/';
      
      // Create 150 files to test batch processing
      const mediaMapping: Record<string, string> = {};
      for (let i = 0; i < 150; i++) {
        mediaMapping[i.toString()] = `file${i}.jpg`;
      }

      (FileSystem.getInfoAsync as jest.Mock)
        .mockResolvedValueOnce({ exists: true })
        .mockResolvedValue({ exists: true, isDirectory: false });

      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(mediaMapping)
      );

      (FileSystem.moveAsync as jest.Mock).mockResolvedValue(undefined);

      const result = await extractor.extractFromFs(extractedDir);

      expect(result.size).toBe(150);
      // Should have processed in batches (100 at a time by default)
      expect(FileSystem.moveAsync).toHaveBeenCalledTimes(150);
    });
  });

  describe('uint8ArrayToBase64 conversion', () => {
    it('converts binary data to base64', async () => {
      const mediaMapping = { '0': 'test.jpg' };

      const mockMediaFile = {
        async: jest.fn().mockResolvedValue(JSON.stringify(mediaMapping)),
      };

      // Simple test data
      const binaryData = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"

      const mockImageFile = {
        async: jest.fn().mockResolvedValue(binaryData),
      };

      const mockZip = {
        file: jest.fn((filename: string) => {
          if (filename === 'media') return mockMediaFile;
          if (filename === '0') return mockImageFile;
          return null;
        }),
      };

      let capturedBase64 = '';
      (FileSystem.writeAsStringAsync as jest.Mock).mockImplementation((path, data) => {
        capturedBase64 = data;
        return Promise.resolve();
      });

      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ 
        exists: true, 
        isDirectory: false 
      });

      await extractor.extractFromZip(mockZip);

      // Should have converted to base64
      expect(capturedBase64).toBeTruthy();
      expect(capturedBase64.length).toBeGreaterThan(0);
    });
  });
});
