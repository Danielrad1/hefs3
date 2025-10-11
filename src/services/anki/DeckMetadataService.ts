import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Deck customization metadata
 */
export interface DeckMetadata {
  deckId: string;
  icon?: string; // Emoji or Ionicons name
  color?: string; // Hex color
  folder?: string; // Folder name the deck belongs to
  order?: number; // Display order
}

/**
 * Folder customization metadata
 */
export interface FolderMetadata {
  folderName: string;
  icon?: string; // Emoji or Ionicons name
  color?: string; // Hex color
  order?: number; // Display order
}

const DECK_METADATA_KEY = '@deck_metadata';
const FOLDER_METADATA_KEY = '@folder_metadata';

/**
 * Service to manage deck customization metadata
 */
export class DeckMetadataService {
  private cache: Map<string, DeckMetadata> = new Map();
  private folderCache: Map<string, FolderMetadata> = new Map();
  private loaded = false;
  private foldersLoaded = false;

  /**
   * Load all metadata from storage
   */
  async load(): Promise<void> {
    try {
      const json = await AsyncStorage.getItem(DECK_METADATA_KEY);
      if (json) {
        const data: Record<string, DeckMetadata> = JSON.parse(json);
        this.cache = new Map(Object.entries(data));
      }
      this.loaded = true;
    } catch (error) {
      console.error('[DeckMetadata] Failed to load:', error);
      this.cache = new Map();
      this.loaded = true;
    }
  }

  async loadFolders(): Promise<void> {
    try {
      const json = await AsyncStorage.getItem(FOLDER_METADATA_KEY);
      if (json) {
        const data: Record<string, FolderMetadata> = JSON.parse(json);
        this.folderCache = new Map(Object.entries(data));
      }
      this.foldersLoaded = true;
    } catch (error) {
      console.error('[FolderMetadata] Failed to load:', error);
      this.folderCache = new Map();
      this.foldersLoaded = true;
    }
  }

  /**
   * Get metadata for a specific deck
   */
  async getMetadata(deckId: string): Promise<DeckMetadata | null> {
    if (!this.loaded) {
      await this.load();
    }
    return this.cache.get(deckId) || null;
  }

  /**
   * Get all metadata
   */
  async getAllMetadata(): Promise<Map<string, DeckMetadata>> {
    if (!this.loaded) {
      await this.load();
    }
    return new Map(this.cache);
  }

  /**
   * Set metadata for a deck
   */
  async setMetadata(metadata: DeckMetadata): Promise<void> {
    if (!this.loaded) {
      await this.load();
    }
    this.cache.set(metadata.deckId, metadata);
    await this.save();
  }

  /**
   * Update metadata for a deck
   */
  async updateMetadata(deckId: string, updates: Partial<Omit<DeckMetadata, 'deckId'>>): Promise<void> {
    if (!this.loaded) {
      await this.load();
    }
    const existing = this.cache.get(deckId) || { deckId };
    this.cache.set(deckId, { ...existing, ...updates });
    await this.save();
  }

  /**
   * Delete metadata for a deck
   */
  async deleteMetadata(deckId: string): Promise<void> {
    if (!this.loaded) {
      await this.load();
    }
    this.cache.delete(deckId);
    await this.save();
  }

  /**
   * Get all unique folders
   */
  async getFolders(): Promise<string[]> {
    if (!this.loaded) {
      await this.load();
    }
    if (!this.foldersLoaded) {
      await this.loadFolders();
    }
    
    const folders = new Set<string>();
    
    // Add folders from folder metadata (includes empty folders)
    for (const folderMeta of this.folderCache.values()) {
      folders.add(folderMeta.folderName);
    }
    
    // Also add folders from deck metadata (in case folder metadata is missing)
    for (const metadata of this.cache.values()) {
      if (metadata.folder) {
        folders.add(metadata.folder);
      }
    }
    
    return Array.from(folders).sort();
  }

  /**
   * Get folder metadata
   */
  async getFolderMetadata(folderName: string): Promise<FolderMetadata | null> {
    if (!this.foldersLoaded) {
      await this.loadFolders();
    }
    return this.folderCache.get(folderName) || null;
  }

  /**
   * Get all folder metadata
   */
  async getAllFolderMetadata(): Promise<Map<string, FolderMetadata>> {
    if (!this.foldersLoaded) {
      await this.loadFolders();
    }
    return new Map(this.folderCache);
  }

  /**
   * Set folder metadata
   */
  async setFolderMetadata(metadata: FolderMetadata): Promise<void> {
    if (!this.foldersLoaded) {
      await this.loadFolders();
    }
    this.folderCache.set(metadata.folderName, metadata);
    await this.saveFolders();
  }

  /**
   * Update folder metadata
   */
  async updateFolderMetadata(folderName: string, updates: Partial<Omit<FolderMetadata, 'folderName'>>): Promise<void> {
    if (!this.foldersLoaded) {
      await this.loadFolders();
    }
    const existing = this.folderCache.get(folderName) || { folderName };
    this.folderCache.set(folderName, { ...existing, ...updates });
    await this.saveFolders();
  }

  /**
   * Delete folder metadata
   */
  async deleteFolderMetadata(folderName: string): Promise<void> {
    if (!this.foldersLoaded) {
      await this.loadFolders();
    }
    this.folderCache.delete(folderName);
    await this.saveFolders();
  }

  /**
   * Save deck metadata to storage
   */
  private async save(): Promise<void> {
    try {
      const data: Record<string, DeckMetadata> = {};
      for (const [key, value] of this.cache.entries()) {
        data[key] = value;
      }
      await AsyncStorage.setItem(DECK_METADATA_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('[DeckMetadata] Failed to save:', error);
    }
  }

  /**
   * Save folder metadata to storage
   */
  private async saveFolders(): Promise<void> {
    try {
      const data: Record<string, FolderMetadata> = {};
      for (const [key, value] of this.folderCache.entries()) {
        data[key] = value;
      }
      await AsyncStorage.setItem(FOLDER_METADATA_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('[FolderMetadata] Failed to save:', error);
    }
  }
}

// Singleton instance
export const deckMetadataService = new DeckMetadataService();
