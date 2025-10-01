/**
 * MediaService - Manage media files (images, audio)
 */

import * as FileSystem from 'expo-file-system/legacy';
import { InMemoryDb } from './InMemoryDb';
import { Media } from './schema';
import { nowSeconds, generateId } from './time';

export const MEDIA_DIR = `${FileSystem.documentDirectory}media/`;

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
   */
  private sanitizeFilename(filename: string): string {
    // Remove any path components (../ or ..\)
    let sanitized = filename.replace(/\.\.[/\\]/g, '');
    
    // Replace unsafe characters with underscore
    // Allow: alphanumeric, dot, dash, underscore
    sanitized = sanitized.replace(/[^A-Za-z0-9._-]/g, '_');
    
    // Limit length to 255 chars (common filesystem limit)
    if (sanitized.length > 255) {
      const ext = sanitized.substring(sanitized.lastIndexOf('.'));
      const name = sanitized.substring(0, 255 - ext.length);
      sanitized = name + ext;
    }
    
    // Ensure not empty
    if (!sanitized || sanitized === '') {
      sanitized = `file_${Date.now()}`;
    }
    
    return sanitized;
  }

  /**
   * Add media file from URI (from picker or camera)
   */
  async addMediaFile(sourceUri: string, filename?: string): Promise<Media> {
    await this.ensureMediaDir();

    // Generate filename if not provided, then sanitize
    const rawFilename = filename || this.generateFilename(sourceUri);
    const finalFilename = this.sanitizeFilename(rawFilename);
    const localUri = MEDIA_DIR + finalFilename;

    // Calculate SHA1 hash
    const sha1 = await this.calculateSha1(sourceUri);

    // Check if media with same SHA1 already exists
    const existing = this.db.getMediaBySha1(sha1);
    if (existing) {
      console.log('[MediaService] Media with same SHA1 already exists:', existing.filename);
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
      sha1,
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
    await this.ensureMediaDir();

    const localUri = MEDIA_DIR + filename;

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

    // Calculate SHA1 hash
    const sha1 = await this.calculateSha1(localUri);

    // Get file size
    const size = 'size' in fileInfo ? fileInfo.size : 0;

    // Determine MIME type
    const mime = this.getMimeType(filename);

    // Create media record
    const media: Media = {
      id: generateId(),
      filename,
      mime,
      sha1,
      size,
      localUri,
      created: nowSeconds(),
    };

    this.db.addMedia(media);
    return media;
  }

  /**
   * Import media file (used during .apkg import)
   */
  async importMedia(filename: string, sourceUri: string): Promise<Media> {
    await this.ensureMediaDir();

    const localUri = MEDIA_DIR + filename;

    // Calculate SHA1 hash
    const sha1 = await this.calculateSha1(sourceUri);

    // Check if media already exists
    const existing = this.db.getMediaByFilename(filename) || this.db.getMediaBySha1(sha1);
    if (existing) {
      console.log('[MediaService] Media already exists:', filename);
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
      sha1,
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
   * Calculate SHA1 hash of file (simplified - uses timestamp + random for now)
   * TODO: Add expo-crypto for real SHA1 hashing when needed
   */
  private async calculateSha1(uri: string): Promise<string> {
    try {
      // Simple hash based on file size and timestamp
      const fileInfo = await FileSystem.getInfoAsync(uri);
      const size = fileInfo.exists && 'size' in fileInfo ? fileInfo.size : 0;
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 15);
      return `sha1-${size}-${timestamp}-${random}`;
    } catch (error) {
      console.error('[MediaService] Error calculating hash:', error);
      return `fallback-${Date.now()}-${Math.random().toString(36).substring(7)}`;
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
