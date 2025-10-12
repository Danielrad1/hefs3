/**
 * MediaService - Manage media files (images, audio)
 */
import * as FileSystem from 'expo-file-system/legacy';
import * as Crypto from 'expo-crypto';
import { InMemoryDb } from './InMemoryDb';
import { Media } from './schema';
import { nowSeconds, generateId } from './time';
import { getMediaUri, MEDIA_DIR, sanitizeMediaFilename } from '../../utils/mediaHelpers';

export class MediaService {
  constructor(private db: InMemoryDb) {
    this.ensureMediaDir();
  }

  /**
   * Ensure media directory exists
   */
  private async ensureMediaDir(): Promise<void> {
    const dirInfo = await FileSystem.getInfoAsync(MEDIA_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(MEDIA_DIR, { intermediates: true });
    }
  }

  /**
   * Sanitize filename to prevent path traversal and ensure safe characters
   * Strips all path components and ensures no directory separators remain
   */
  private sanitizeFilename(filename: string): string {
    // Generate a filename if empty
    if (!filename || filename.trim() === '') {
      return `file_${Date.now()}`;
    }
    return sanitizeMediaFilename(filename);
  }

  /**
   * Add media file from URI (from picker or camera)
   */
  async addMediaFile(sourceUri: string, filename?: string): Promise<Media> {
    await this.ensureMediaDir();

    // Generate filename if not provided, then sanitize
    const rawFilename = filename || this.generateFilename(sourceUri);
    const finalFilename = sanitizeMediaFilename(rawFilename);
    const localUri = getMediaUri(finalFilename);

    // Calculate content hash
    const hash = await this.calculateHash(sourceUri);

    // Check if media with same hash already exists (deduplication)
    const existing = this.db.getMediaByHash(hash);
    if (existing) {
      console.log('[MediaService] Media with same hash already exists, deduplicating:', existing.filename);
      return existing;
    }

    // Copy file to media directory
    await FileSystem.copyAsync({
      from: sourceUri,
      to: localUri,
    });

    // Get file info
    const fileInfo = await FileSystem.getInfoAsync(localUri);
    const size = fileInfo.exists && 'size' in fileInfo ? fileInfo.size : 0;

    // Determine MIME type
    const mime = this.getMimeType(finalFilename);

    // Create media record
    const media: Media = {
      id: generateId(),
      filename: finalFilename,
      mime,
      hash,
      size,
      localUri,
      created: nowSeconds(),
    };

    this.db.addMedia(media);
    return media;
  }

  /**
   * Register existing media file (used during .apkg import when files are already in place)
   */
  async registerExistingMedia(filename: string): Promise<Media | null> {
    // Validate filename
    if (!filename || filename.trim() === '') {
      return null;
    }

    await this.ensureMediaDir();

    const localUri = getMediaUri(filename);

    // Check if file exists
    const fileInfo = await FileSystem.getInfoAsync(localUri);
    if (!fileInfo.exists) {
      console.warn('[MediaService] File does not exist:', localUri);
      return null;
    }

    // Check if media already registered
    const existing = this.db.getMediaByFilename(filename);
    if (existing) {
      return existing;
    }

    // Calculate content hash
    const size = 'size' in fileInfo ? fileInfo.size : 0;
    const hash = await this.calculateHash(localUri);

    // Determine MIME type
    const mime = this.getMimeType(filename);

    // Create media record
    const media: Media = {
      id: generateId(),
      filename,
      mime,
      hash,
      size,
      localUri,
      created: nowSeconds(),
    };

    this.db.addMedia(media);
    return media;
  }

  /**
   * Batch register existing media files (optimized for bulk imports)
   * Processes files in parallel batches for better performance
   */
  async batchRegisterExistingMedia(filenames: string[], onProgress?: (current: number, total: number) => void): Promise<Map<string, Media | null>> {
    await this.ensureMediaDir();
    
    const results = new Map<string, Media | null>();
    const BATCH_SIZE = 50; // Process 50 files at a time
    
    for (let i = 0; i < filenames.length; i += BATCH_SIZE) {
      const batch = filenames.slice(i, i + BATCH_SIZE);
      
      // Process batch in parallel
      const batchResults = await Promise.all(
        batch.map(async (filename) => {
          try {
            // Check if already registered first (no filesystem call)
            const existing = this.db.getMediaByFilename(filename);
            if (existing) {
              return { filename, media: existing };
            }

            const localUri = getMediaUri(filename);
            const fileInfo = await FileSystem.getInfoAsync(localUri);
            
            if (!fileInfo.exists) {
              console.warn('[MediaService] File does not exist:', localUri);
              return { filename, media: null };
            }

            // Create media record with real hash calculation
            const size = 'size' in fileInfo ? fileInfo.size : 0;
            const hash = await this.calculateHash(localUri);
            const mime = this.getMimeType(filename);

            const media: Media = {
              id: generateId(),
              filename,
              mime,
              hash,
              size,
              localUri,
              created: nowSeconds(),
            };

            this.db.addMedia(media);
            return { filename, media };
          } catch (error) {
            console.error('[MediaService] Error registering media:', filename, error);
            return { filename, media: null };
          }
        })
      );
      
      // Add batch results to map
      batchResults.forEach(({ filename, media }) => {
        results.set(filename, media);
      });
      
      // Report progress
      const processed = Math.min(i + BATCH_SIZE, filenames.length);
      onProgress?.(processed, filenames.length);
    }
    
    return results;
  }

  /**
   * Import media file (used during .apkg import)
   */
  async importMedia(filename: string, sourceUri: string): Promise<Media> {
    await this.ensureMediaDir();

    const localUri = MEDIA_DIR + filename;

    // Calculate content hash
    const hash = await this.calculateHash(sourceUri);

    // Check if media already exists (by filename or hash)
    const existing = this.db.getMediaByFilename(filename) || this.db.getMediaByHash(hash);
    if (existing) {
      console.log('[MediaService] Media already exists, deduplicating:', filename);
      return existing;
    }

    // Copy file
    await FileSystem.copyAsync({
      from: sourceUri,
      to: localUri,
    });

    // Get file info
    const fileInfo = await FileSystem.getInfoAsync(localUri);
    const size = fileInfo.exists && 'size' in fileInfo ? fileInfo.size : 0;

    // Determine MIME type
    const mime = this.getMimeType(filename);

    // Create media record
    const media: Media = {
      id: generateId(),
      filename,
      mime,
      hash,
      size,
      localUri,
      created: nowSeconds(),
    };

    this.db.addMedia(media);
    return media;
  }

  /**
   * Get media by ID
   */
  getMedia(id: string): Media | undefined {
    return this.db.getMedia(id);
  }

  /**
   * Get media by filename
   */
  getMediaByFilename(filename: string): Media | undefined {
    return this.db.getMediaByFilename(filename);
  }

  /**
   * Delete media file
   */
  async deleteMedia(id: string): Promise<void> {
    const media = this.db.getMedia(id);
    if (!media) {
      throw new Error(`Media ${id} not found`);
    }

    // Delete file
    try {
      await FileSystem.deleteAsync(media.localUri, { idempotent: true });
    } catch (error) {
      console.error('[MediaService] Error deleting file:', error);
    }

    // Delete record
    this.db.deleteMedia(id);
  }

  /**
   * Garbage collect unused media
   * Deletes media files not referenced in any note fields
   */
  async gcUnused(): Promise<number> {
    const allMedia = this.db.getAllMedia();
    const allNotes = this.db.getAllNotes();

    // Collect all referenced filenames
    const referencedFilenames = new Set<string>();
    allNotes.forEach((note) => {
      const fields = note.flds;
      
      // Find image references: <img src="filename">
      const imgRegex = /<img[^>]+src="([^"]+)"/gi;
      let match;
      while ((match = imgRegex.exec(fields)) !== null) {
        referencedFilenames.add(match[1]);
      }
      
      // Find audio references: [sound:filename]
      const audioRegex = /\[sound:([^\]]+)\]/gi;
      while ((match = audioRegex.exec(fields)) !== null) {
        referencedFilenames.add(match[1]);
      }
    });

    // Delete unreferenced media
    let deletedCount = 0;
    for (const media of allMedia) {
      if (!referencedFilenames.has(media.filename)) {
        await this.deleteMedia(media.id);
        deletedCount++;
      }
    }

    console.log(`[MediaService] Garbage collected ${deletedCount} unused media files`);
    return deletedCount;
  }

  /**
   * Resolve media src in HTML
   * Converts anki-media://<id> to file:// URI
   */
  resolveSrc(src: string): string {
    if (src.startsWith('anki-media://')) {
      const id = src.replace('anki-media://', '');
      const media = this.db.getMedia(id);
      return media ? media.localUri : src;
    }
    
    // Check if it's a filename reference
    const media = this.db.getMediaByFilename(src);
    if (media) {
      return media.localUri;
    }
    
    // Default: assume it's in media directory
    return MEDIA_DIR + src;
  }

  /**
   * Calculate SHA-256 hash of file
   * Uses expo-crypto for deterministic, cryptographically-secure hashing
   * Enables proper deduplication and integrity checking
   */
  private async calculateHash(uri: string): Promise<string> {
    try {
      // Read file as base64 for hashing
      // Note: For very large files, consider streaming/chunked hashing in future
      const fileContents = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      // Hash the base64 string - this is deterministic
      const hash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        fileContents,
        { encoding: Crypto.CryptoEncoding.HEX }
      );
      
      return hash;
    } catch (error) {
      console.error('[MediaService] Error calculating hash:', error);
      // Fallback: use file info as hash (still better than random)
      try {
        const fileInfo = await FileSystem.getInfoAsync(uri);
        const size = fileInfo.exists && 'size' in fileInfo ? fileInfo.size : 0;
        const modTime = fileInfo.exists && 'modificationTime' in fileInfo ? fileInfo.modificationTime : Date.now();
        return `fallback-${size}-${modTime}`;
      } catch {
        return `error-${Date.now()}`;
      }
    }
  }

  /**
   * Generate filename from URI
   */
  private generateFilename(uri: string): string {
    const parts = uri.split('/');
    const originalName = parts[parts.length - 1];
    const timestamp = Date.now();
    
    // Extract extension
    const ext = originalName.split('.').pop() || 'bin';
    
    return `media-${timestamp}.${ext}`;
  }

  /**
   * Get MIME type from filename
   */
  private getMimeType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    
    switch (ext) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'gif':
        return 'image/gif';
      case 'webp':
        return 'image/webp';
      case 'svg':
        return 'image/svg+xml';
      case 'mp3':
        return 'audio/mpeg';
      case 'm4a':
        return 'audio/mp4';
      case 'aac':
        return 'audio/aac';
      case 'wav':
        return 'audio/wav';
      case 'ogg':
        return 'audio/ogg';
      default:
        return 'application/octet-stream';
    }
  }
}
