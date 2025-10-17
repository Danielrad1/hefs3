/**
 * Media Extractor
 * Handles extraction and placement of media files from .apkg archives
 */

import * as FileSystem from 'expo-file-system/legacy';
import { ApkgParseOptions } from './types';
import { ProgressReporter } from './ProgressReporter';
import { logger } from '../../../utils/logger';

export class MediaExtractor {
  private mediaDir: string;

  constructor(mediaDir: string) {
    this.mediaDir = mediaDir;
  }

  /**
   * Extract media files from JSZip archive
   */
  async extractFromZip(zip: any, options: ApkgParseOptions = {}): Promise<Map<string, string>> {
    const progress = new ProgressReporter(options);
    const mediaMap = new Map<string, string>();

    // Check for media file (JSON mapping)
    const mediaFile = zip.file('media');
    if (!mediaFile) {
      logger.info('[MediaExtractor] No media file found in .apkg');
      return mediaMap;
    }

    const mediaJson = await mediaFile.async('string');
    logger.info('[MediaExtractor] Media mapping:', mediaJson);
    const mediaMapping = JSON.parse(mediaJson) as Record<string, string>;
    logger.info('[MediaExtractor] Found', Object.keys(mediaMapping).length, 'media files to extract');

    // Extract each media file
    const entries = Object.entries(mediaMapping);
    let index = 0;
    for (const [id, filename] of entries) {
      index++;
      const file = zip.file(id);
      if (file) {
        // Encode filename for URI path (# and other special chars need encoding in file:// URIs)
        const blob = await file.async('uint8array');
        const encodedFilename = encodeURIComponent(filename);
        const destPath = `${this.mediaDir}${encodedFilename}`;

        logger.info(`[MediaExtractor] Writing media file: ${filename} → ${encodedFilename}`);
        await FileSystem.writeAsStringAsync(
          destPath,
          this.uint8ArrayToBase64(blob),
          { encoding: FileSystem.EncodingType.Base64 }
        );
        if (index % 25 === 0) {
          progress.report(`Extracting media… (${index}/${entries.length})`);
        }

        // Verify file was written
        const fileInfo = await FileSystem.getInfoAsync(destPath);
        const size = fileInfo.exists && !fileInfo.isDirectory ? (fileInfo as any).size : 0;
        logger.info(
          `[MediaExtractor] Media file written: ${filename}, exists: ${fileInfo.exists}, size: ${size}`
        );

        mediaMap.set(id, filename);
      } else {
        logger.warn(`[MediaExtractor] Media file ${id} (${filename}) not found in zip`);
      }
    }

    logger.info(`[MediaExtractor] Extracted ${mediaMap.size} media files to ${this.mediaDir}`);
    return mediaMap;
  }

  /**
   * Extract media files from filesystem (streaming unzip path)
   * Uses direct copy/move to avoid large base64 strings
   */
  async extractFromFs(
    extractedDir: string,
    options: ApkgParseOptions = {}
  ): Promise<Map<string, string>> {
    const progress = new ProgressReporter(options);
    const mediaMap = new Map<string, string>();

    // media mapping JSON lives at <extractedDir>/media
    const mediaMappingPath = `${extractedDir}media`;
    const info = await FileSystem.getInfoAsync(mediaMappingPath);
    if (!info.exists) {
      logger.info('[MediaExtractor] No media file found in extracted folder');
      return mediaMap;
    }

    const mediaJson = await FileSystem.readAsStringAsync(mediaMappingPath);
    logger.info('[MediaExtractor] Media mapping (fs):', mediaJson);
    const mediaMapping = JSON.parse(mediaJson) as Record<string, string>;
    logger.info('[MediaExtractor] Found', Object.keys(mediaMapping).length, 'media files to move');

    const entries = Object.entries(mediaMapping);
    let index = 0;
    for (const [id, filename] of entries) {
      index++;
      const srcPath = `${extractedDir}${id}`;
      const srcInfo = await FileSystem.getInfoAsync(srcPath);
      if (!srcInfo.exists || srcInfo.isDirectory) {
        logger.warn(`[MediaExtractor] Media file ${id} (${filename}) not found on disk after unzip`);
        continue;
      }

      // Encode filename for URI path (# and other special chars need encoding in file:// URIs)
      const encodedFilename = encodeURIComponent(filename);
      const destPath = `${this.mediaDir}${encodedFilename}`;

      // Log the specific file being processed
      logger.info(
        `[MediaExtractor] Processing media ${index}/${entries.length}: ${filename} → ${encodedFilename}`
      );

      try {
        // Prefer move to avoid doubling storage usage
        await FileSystem.moveAsync({ from: srcPath, to: destPath });
      } catch (e) {
        logger.warn('[MediaExtractor] moveAsync failed, falling back to copyAsync', e);
        await FileSystem.copyAsync({ from: srcPath, to: destPath });
      }

      const writtenInfo = await FileSystem.getInfoAsync(destPath);
      const size = writtenInfo.exists && !writtenInfo.isDirectory ? (writtenInfo as any).size : 0;
      logger.info(
        `[MediaExtractor] Media file placed: ${filename}, exists: ${writtenInfo.exists}, size: ${size}`
      );

      // Store filename (no changes needed since we use original names)
      mediaMap.set(filename, filename);

      // Update progress every file for the last 10
      if (index >= entries.length - 10 || index % 25 === 0) {
        progress.report(`Placing media… (${index}/${entries.length})`);
      }
    }

    logger.info(`[MediaExtractor] Extracted ${mediaMap.size} media files to ${this.mediaDir} (fs move)`);
    return mediaMap;
  }

  /**
   * Convert Uint8Array to base64 string
   * Using safe implementation that works in React Native without atob/btoa
   */
  private uint8ArrayToBase64(uint8Array: Uint8Array): string {
    const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let result = '';
    const len = uint8Array.length;

    for (let i = 0; i < len; i += 3) {
      const byte1 = uint8Array[i];
      const byte2 = i + 1 < len ? uint8Array[i + 1] : 0;
      const byte3 = i + 2 < len ? uint8Array[i + 2] : 0;

      const encoded1 = byte1 >> 2;
      const encoded2 = ((byte1 & 0x03) << 4) | (byte2 >> 4);
      const encoded3 = ((byte2 & 0x0f) << 2) | (byte3 >> 6);
      const encoded4 = byte3 & 0x3f;

      result += base64Chars[encoded1];
      result += base64Chars[encoded2];
      result += i + 1 < len ? base64Chars[encoded3] : '=';
      result += i + 2 < len ? base64Chars[encoded4] : '=';
    }

    return result;
  }
}
