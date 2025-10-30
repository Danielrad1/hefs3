/**
 * Test suite for DiscoverService
 * Tests cache TTL, stale fallback, download validation, and error handling
 */

import { DiscoverService, DiscoverCatalog, DeckManifest } from '../DiscoverService';

// Mock logger
jest.mock('../../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

// Mock expo-file-system
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file://mock/',
  cacheDirectory: 'file://mock/cache/',
  getInfoAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
  deleteAsync: jest.fn(),
  createDownloadResumable: jest.fn(),
}));

describe('DiscoverService', () => {
  const mockCatalog: DiscoverCatalog = {
    decks: [
      {
        id: 'deck1',
        name: 'Test Deck',
        description: 'A test deck',
        cardCount: 100,
        downloadUrl: 'https://example.com/deck1.apkg',
        tags: ['test'],
        difficulty: 'beginner',
        language: 'en',
        size: 1024,
      },
    ],
    categories: ['test'],
    lastUpdated: Date.now(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    DiscoverService.clearCache();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('getCatalog', () => {
    it('fetches catalog from hosting on first call', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => mockCatalog,
      } as any);

      const catalog = await DiscoverService.getCatalog();

      expect(catalog).toEqual(mockCatalog);
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/decks/decks.json'),
        expect.objectContaining({ cache: 'no-store' })
      );
    });

    it('returns cached catalog within TTL', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => mockCatalog,
      } as any);

      // First call
      await DiscoverService.getCatalog();
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Advance time but stay within TTL (24 hours)
      jest.advanceTimersByTime(1000 * 60 * 60); // 1 hour

      // Second call should use cache
      await DiscoverService.getCatalog();
      expect(fetchSpy).toHaveBeenCalledTimes(1); // No additional fetch
    });

    it('refetches after TTL expires', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => mockCatalog,
      } as any);

      // First call
      await DiscoverService.getCatalog();
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Advance time past TTL (24 hours)
      jest.advanceTimersByTime(1000 * 60 * 60 * 25); // 25 hours

      // Second call should fetch again
      await DiscoverService.getCatalog();
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('returns stale cache on fetch failure', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch')
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockCatalog,
        } as any)
        .mockRejectedValueOnce(new Error('Network error'));

      // First call succeeds
      const firstResult = await DiscoverService.getCatalog();
      expect(firstResult).toEqual(mockCatalog);

      // Expire cache
      jest.advanceTimersByTime(1000 * 60 * 60 * 25);

      // Second call fails but returns stale cache
      const secondResult = await DiscoverService.getCatalog();
      expect(secondResult).toEqual(mockCatalog);
    });

    it('throws on fetch failure with no cache', async () => {
      jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));

      await expect(DiscoverService.getCatalog()).rejects.toThrow('Network error');
    });

    it('throws on non-ok response with no cache', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 404,
      } as any);

      await expect(DiscoverService.getCatalog()).rejects.toThrow('Failed to fetch catalog: 404');
    });

    it('includes cache buster in request', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => mockCatalog,
      } as any);

      await DiscoverService.getCatalog();

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\?t=\d+$/),
        expect.anything()
      );
    });
  });

  describe('downloadDeck', () => {
    const mockDeck: DeckManifest = {
      id: 'test-deck',
      name: 'Test Deck',
      description: 'Test',
      cardCount: 100,
      downloadUrl: 'https://example.com/test.apkg',
      tags: [],
      difficulty: 'beginner',
      language: 'en',
      size: 1024,
    };

    beforeEach(() => {
      const FileSystem = require('expo-file-system/legacy');
      
      // Default mocks for successful download
      FileSystem.getInfoAsync.mockResolvedValue({
        exists: true,
        size: 1024,
      });
      
      FileSystem.createDownloadResumable.mockReturnValue({
        downloadAsync: jest.fn().mockResolvedValue({
          uri: 'file://mock/cache/test-deck.apkg',
          status: 200,
          headers: {},
        }),
      });

      FileSystem.deleteAsync.mockResolvedValue(undefined);
    });

    it('validates download URL starts with http/https', async () => {
      const invalidDeck = { ...mockDeck, downloadUrl: 'ftp://invalid.com/file.apkg' };

      await expect(DiscoverService.downloadDeck(invalidDeck)).rejects.toThrow(
        'Download URL must be HTTP/HTTPS'
      );
    });

    it('validates download URL is not empty', async () => {
      const invalidDeck = { ...mockDeck, downloadUrl: 'http' };

      await expect(DiscoverService.downloadDeck(invalidDeck)).rejects.toThrow(
        'Invalid download URL'
      );
    });

    it('deletes existing file before download', async () => {
      const FileSystem = require('expo-file-system/legacy');
      
      FileSystem.getInfoAsync
        .mockResolvedValueOnce({ exists: true, size: 512 }) // Existing file check
        .mockResolvedValueOnce({ exists: true, size: 1024 }); // Post-download check

      await DiscoverService.downloadDeck(mockDeck);

      expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
        expect.stringContaining('test-deck.apkg'),
        { idempotent: true }
      );
    });

    it('invokes progress callback during download', async () => {
      const FileSystem = require('expo-file-system/legacy');
      const onProgress = jest.fn();

      let progressCallback: any;
      FileSystem.createDownloadResumable.mockReturnValue({
        downloadAsync: jest.fn().mockImplementation(async () => {
          // Simulate progress updates
          progressCallback({
            totalBytesWritten: 512,
            totalBytesExpectedToWrite: 1024,
          });
          progressCallback({
            totalBytesWritten: 1024,
            totalBytesExpectedToWrite: 1024,
          });
          
          return {
            uri: 'file://mock/cache/test-deck.apkg',
            status: 200,
            headers: {},
          };
        }),
      });

      // Capture the progress callback
      const createSpy = jest.spyOn(FileSystem, 'createDownloadResumable');
      await DiscoverService.downloadDeck(mockDeck, onProgress);
      
      progressCallback = createSpy.mock.calls[0][3]; // Get the callback
      
      // Invoke it to trigger progress
      progressCallback({
        totalBytesWritten: 512,
        totalBytesExpectedToWrite: 1024,
      });

      expect(onProgress).toHaveBeenCalled();
    });

    it('verifies downloaded file exists', async () => {
      const FileSystem = require('expo-file-system/legacy');
      
      FileSystem.getInfoAsync
        .mockResolvedValueOnce({ exists: false }) // Initial check
        .mockResolvedValueOnce({ exists: false, size: 0 }); // Post-download check

      await expect(DiscoverService.downloadDeck(mockDeck)).rejects.toThrow(
        'File does not exist after download'
      );
    });

    it('verifies downloaded file is not empty', async () => {
      const FileSystem = require('expo-file-system/legacy');
      
      FileSystem.getInfoAsync
        .mockResolvedValueOnce({ exists: false }) // Initial check
        .mockResolvedValueOnce({ exists: true, size: 0 }); // Post-download check (0 bytes)

      await expect(DiscoverService.downloadDeck(mockDeck)).rejects.toThrow(
        'File is empty (0 bytes)'
      );
    });

    it('returns file URI on successful download', async () => {
      const uri = await DiscoverService.downloadDeck(mockDeck);

      expect(uri).toBe('file://mock/cache/test-deck.apkg');
    });

    it('throws on download failure', async () => {
      const FileSystem = require('expo-file-system/legacy');
      
      FileSystem.createDownloadResumable.mockReturnValue({
        downloadAsync: jest.fn().mockRejectedValue(new Error('Download failed')),
      });

      await expect(DiscoverService.downloadDeck(mockDeck)).rejects.toThrow('Download failed');
    });

    it('throws when download result is null', async () => {
      const FileSystem = require('expo-file-system/legacy');
      
      FileSystem.createDownloadResumable.mockReturnValue({
        downloadAsync: jest.fn().mockResolvedValue(null),
      });

      await expect(DiscoverService.downloadDeck(mockDeck)).rejects.toThrow(
        'Download failed: No result returned'
      );
    });
  });

  describe('clearCache', () => {
    it('clears cache and forces refetch', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => mockCatalog,
      } as any);

      // First call
      await DiscoverService.getCatalog();
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Clear cache
      DiscoverService.clearCache();

      // Next call should fetch again (even within TTL)
      await DiscoverService.getCatalog();
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('forceRefresh', () => {
    it('bypasses cache and fetches new data', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => mockCatalog,
      } as any);

      // First call
      await DiscoverService.getCatalog();
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Force refresh (within TTL)
      await DiscoverService.forceRefresh();
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });
});
