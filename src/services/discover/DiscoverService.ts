/**
 * Service for fetching curated deck catalog from Firebase Hosting
 */

import { logger } from '../../utils/logger';

const HOSTING_BASE = 'https://hefs-b3e45.web.app';

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
      logger.info('[DiscoverService] Downloading deck:', deck.name);
      
      // Create a local file path in cache
      const filename = `${deck.id}.apkg`;
      const localPath = `${FileSystem.cacheDirectory}${filename}`;
      
      // Download with progress
      const downloadResumable = FileSystem.createDownloadResumable(
        deck.downloadUrl,
        localPath,
        {},
        (downloadProgress: any) => {
          const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
          onProgress?.(progress * 100);
        }
      );

      const result = await downloadResumable.downloadAsync();
      
      if (!result) {
        throw new Error('Download failed');
      }
      
      logger.info('[DiscoverService] Download complete:', result.uri);
      return result.uri;
    } catch (error) {
      logger.error('[DiscoverService] Deck download failed:', error);
      throw error;
    }
  }

  /**
   * Clear cache
   */
  static clearCache(): void {
    this.cache = { data: null, timestamp: 0 };
    logger.info('[DiscoverService] Cache cleared');
  }
}
