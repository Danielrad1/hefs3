/**
 * Service for fetching curated deck catalog from Firebase Hosting
 */

import { logger } from '../../utils/logger';

const HOSTING_BASE = 'https://enqode-6b13f.web.app';

export interface DeckManifest {
  id: string;
  name: string;
  description: string;
  cardCount: number;
  downloadUrl: string;
  thumbnail?: {
    icon: string;
    color: string;
  } | null;
  tags: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  language: string;
  size: number;
  author?: string;
  version?: string;
  createdAt?: number;
}

export interface DiscoverCatalog {
  decks: DeckManifest[];
  categories: string[];
  lastUpdated: number;
  version?: string;
}

export class DiscoverService {
  private static cache: { data: DiscoverCatalog | null; timestamp: number } = {
    data: null,
    timestamp: 0,
  };
  private static CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Fetch available decks from Firebase Hosting
   */
  static async getCatalog(): Promise<DiscoverCatalog> {
    const now = Date.now();
    
    // Return cached if still valid
    if (this.cache.data && now - this.cache.timestamp < this.CACHE_TTL) {
      logger.info('[DiscoverService] Returning cached catalog');
      return this.cache.data;
    }

    try {
      logger.info('[DiscoverService] Fetching catalog from hosting...');
      const cacheBuster = `?t=${Date.now()}`;
      const response = await fetch(`${HOSTING_BASE}/decks/decks.json${cacheBuster}`, {
        cache: 'no-store',
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch catalog: ${response.status}`);
      }

      const data: DiscoverCatalog = await response.json();
      this.cache = { data, timestamp: now };
      
      logger.info('[DiscoverService] Catalog loaded:', data.decks.length, 'decks');
      return data;
    } catch (error) {
      logger.error('[DiscoverService] Failed to fetch catalog:', error);
      
      // Return cached data even if expired, or throw
      if (this.cache.data) {
        logger.info('[DiscoverService] Using stale cache due to error');
        return this.cache.data;
      }
      throw error;
    }
  }

  /**
   * Download deck file to local cache
   */
  static async downloadDeck(
    deck: DeckManifest,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    const FileSystem = require('expo-file-system/legacy');
    
    try {
      logger.info('[DiscoverService] Starting download for deck:', deck.name);
      logger.info('[DiscoverService] Download URL:', deck.downloadUrl);
      logger.info('[DiscoverService] Expected size:', deck.size, 'bytes');
      
      // Check if URL looks valid
      if (!deck.downloadUrl || deck.downloadUrl.length < 10) {
        throw new Error('Invalid download URL: ' + deck.downloadUrl);
      }
      
      if (!deck.downloadUrl.startsWith('http://') && !deck.downloadUrl.startsWith('https://')) {
        throw new Error('Download URL must be HTTP/HTTPS: ' + deck.downloadUrl);
      }
      
      // Create a local file path in cache
      const filename = `${deck.id}.apkg`;
      const localPath = `${FileSystem.cacheDirectory}${filename}`;
      logger.info('[DiscoverService] Target path:', localPath);
      
      // Check if file already exists and delete it
      const fileInfo = await FileSystem.getInfoAsync(localPath);
      if (fileInfo.exists) {
        logger.info('[DiscoverService] Existing file found, deleting...');
        await FileSystem.deleteAsync(localPath, { idempotent: true });
      }
      
      // Throttle progress updates to prevent excessive re-renders
      let lastProgress = 0;
      let lastEmitTime = 0;
      const MIN_PROGRESS_DELTA = 1; // Only emit if progress changed by ≥1%
      const MIN_TIME_DELTA = 120; // Only emit if ≥120ms elapsed
      
      // Download with progress
      const downloadResumable = FileSystem.createDownloadResumable(
        deck.downloadUrl,
        localPath,
        {},
        (downloadProgress: any) => {
          logger.info('[DiscoverService] Download progress:', {
            written: downloadProgress.totalBytesWritten,
            expected: downloadProgress.totalBytesExpectedToWrite,
            percent: ((downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite) * 100).toFixed(1) + '%'
          });
          
          const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
          const progressPercent = progress * 100;
          const now = Date.now();
          
          // Throttle: only emit if significant change or enough time passed
          if (
            Math.abs(progressPercent - lastProgress) >= MIN_PROGRESS_DELTA ||
            now - lastEmitTime >= MIN_TIME_DELTA
          ) {
            lastProgress = progressPercent;
            lastEmitTime = now;
            onProgress?.(progressPercent);
          }
        }
      );

      logger.info('[DiscoverService] Starting download...');
      const result = await downloadResumable.downloadAsync();
      
      if (!result) {
        logger.error('[DiscoverService] Download result is null/undefined');
        throw new Error('Download failed: No result returned');
      }
      
      logger.info('[DiscoverService] Download result:', {
        uri: result.uri,
        status: result.status,
        headers: result.headers
      });
      
      // Verify the downloaded file
      const downloadedFileInfo = await FileSystem.getInfoAsync(result.uri);
      logger.info('[DiscoverService] Downloaded file info:', downloadedFileInfo);
      
      if (!downloadedFileInfo.exists) {
        throw new Error('Download failed: File does not exist after download');
      }
      
      if (downloadedFileInfo.size === 0) {
        throw new Error('Download failed: File is empty (0 bytes)');
      }
      
      if (downloadedFileInfo.size < 100) {
        logger.warn('[DiscoverService] File is suspiciously small:', downloadedFileInfo.size, 'bytes');
      }
      
      logger.info('[DiscoverService] Download complete and verified:', result.uri, 'Size:', downloadedFileInfo.size, 'bytes');
      return result.uri;
    } catch (error: any) {
      logger.error('[DiscoverService] Deck download failed:', {
        error: error?.message || error,
        stack: error?.stack,
        deckName: deck.name,
        downloadUrl: deck.downloadUrl
      });
      throw error;
    }
  }

  /**
   * Clear cache and force refresh
   */
  static clearCache(): void {
    this.cache = { data: null, timestamp: 0 };
    logger.info('[DiscoverService] Cache cleared');
  }

  /**
   * Force refresh catalog (bypass cache)
   */
  static async forceRefresh(): Promise<{ decks: DeckManifest[]; categories: string[] }> {
    this.clearCache();
    return this.getCatalog();
  }
}
