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

    // Check for media file (JSON or Protobuf mapping)
    const mediaFile = zip.file('media');
    if (!mediaFile) {
      logger.info('[MediaExtractor] No media file found in .apkg');
      return mediaMap;
    }

    // Try to parse as JSON first, fall back to Protobuf handling
    let mediaMapping: Record<string, string> = {};
    try {
      const mediaContent = await mediaFile.async('string');
      logger.info('[MediaExtractor] Media file content length:', mediaContent.length);
      
      // Check if it looks like JSON (starts with { or is empty {})
      const trimmed = mediaContent.trim();
      if (trimmed.startsWith('{')) {
        mediaMapping = JSON.parse(mediaContent) as Record<string, string>;
        logger.info('[MediaExtractor] ✓ Parsed JSON media mapping with', Object.keys(mediaMapping).length, 'entries');
      } else {
        logger.warn('[MediaExtractor] Media file is not JSON (possibly Protobuf) - scanning for numbered files');
        mediaMapping = await this.scanForMediaFilesInZip(zip);
      }
    } catch (e) {
      logger.info('[MediaExtractor] Media mapping is Protobuf (not JSON) - scanning for numbered files');
      mediaMapping = await this.scanForMediaFilesInZip(zip);
    }
    
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
   * Processes files in parallel batches for better performance
   */
  async extractFromFs(
    extractedDir: string,
    options: ApkgParseOptions = {}
  ): Promise<Map<string, string>> {
    const progress = new ProgressReporter(options);
    const mediaMap = new Map<string, string>();

    // media mapping lives at <extractedDir>/media - could be JSON or Protobuf
    const mediaMappingPath = `${extractedDir}media`;
    const info = await FileSystem.getInfoAsync(mediaMappingPath);
    if (!info.exists) {
      logger.info('[MediaExtractor] No media file found in extracted folder');
      return mediaMap;
    }

    // Try to parse as JSON first, fall back to scanning for numbered files
    let mediaMapping: Record<string, string> = {};
    try {
      const mediaContent = await FileSystem.readAsStringAsync(mediaMappingPath);
      logger.info('[MediaExtractor] Media file content length:', mediaContent.length);
      
      // Check if it looks like JSON (starts with { or is empty {})
      const trimmed = mediaContent.trim();
      if (trimmed.startsWith('{')) {
        mediaMapping = JSON.parse(mediaContent) as Record<string, string>;
        logger.info('[MediaExtractor] ✓ Parsed JSON media mapping with', Object.keys(mediaMapping).length, 'entries');
      } else {
        logger.warn('[MediaExtractor] Media file is not JSON (possibly Protobuf) - scanning for numbered files');
        mediaMapping = await this.scanForMediaFilesOnDisk(extractedDir);
      }
    } catch (e) {
      logger.info('[MediaExtractor] Media mapping is Protobuf (not JSON) - scanning for numbered files');
      mediaMapping = await this.scanForMediaFilesOnDisk(extractedDir);
    }
    
    logger.info('[MediaExtractor] Found', Object.keys(mediaMapping).length, 'media files to move');

    const entries = Object.entries(mediaMapping);
    
    // Process files in parallel batches for faster extraction
    const BATCH_SIZE = 100;
    let processedCount = 0;

    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const batch = entries.slice(i, i + BATCH_SIZE);
      
      await Promise.all(
        batch.map(async ([id, filename]) => {
          const srcPath = `${extractedDir}${id}`;
          const srcInfo = await FileSystem.getInfoAsync(srcPath);
          if (!srcInfo.exists || srcInfo.isDirectory) {
            logger.warn(`[MediaExtractor] Media file ${id} (${filename}) not found on disk after unzip`);
            return;
          }

          // Encode filename for URI path (# and other special chars need encoding in file:// URIs)
          const encodedFilename = encodeURIComponent(filename);
          const destPath = `${this.mediaDir}${encodedFilename}`;

          try {
            // Prefer move to avoid doubling storage usage
            await FileSystem.moveAsync({ from: srcPath, to: destPath });
          } catch (e) {
            logger.warn('[MediaExtractor] moveAsync failed, falling back to copyAsync', e);
            await FileSystem.copyAsync({ from: srcPath, to: destPath });
          }

          // Store filename (no changes needed since we use original names)
          mediaMap.set(filename, filename);
        })
      );

      processedCount += batch.length;
      progress.report(`Placing media… (${processedCount}/${entries.length})`);
      
      // Log progress every batch
      logger.info(`[MediaExtractor] Placed batch: ${processedCount}/${entries.length} files`);
    }

    logger.info(`[MediaExtractor] Extracted ${mediaMap.size} media files to ${this.mediaDir} (fs move)`);
    return mediaMap;
  }

  /**
   * Scan for numbered media files in a JSZip archive
   * First tries to parse Protobuf, falls back to using numbered names
   */
  private async scanForMediaFilesInZip(zip: any): Promise<Record<string, string>> {
    // First try to parse the Protobuf media mapping
    const mediaFile = zip.file('media');
    if (mediaFile) {
      try {
        const binaryData = await mediaFile.async('uint8array');
        const protobufMapping = this.parseMediaProtobuf(binaryData);
        if (Object.keys(protobufMapping).length > 0) {
          logger.info('[MediaExtractor] ✓ Parsed Protobuf media mapping with', Object.keys(protobufMapping).length, 'entries');
          return protobufMapping;
        }
      } catch (e) {
        logger.warn('[MediaExtractor] Failed to parse Protobuf media mapping:', e);
      }
    }
    
    // Fallback: scan for numbered files
    const mediaMapping: Record<string, string> = {};
    const files = Object.keys(zip.files);
    
    for (const filename of files) {
      // Media files are numbered: 0, 1, 2, etc.
      if (/^\d+$/.test(filename)) {
        // Use the number as both key and filename (we don't know the real name)
        mediaMapping[filename] = `media_${filename}`;
      }
    }
    
    logger.info('[MediaExtractor] Scanned ZIP, found', Object.keys(mediaMapping).length, 'numbered media files (fallback)');
    return mediaMapping;
  }

  /**
   * Scan for numbered media files on disk
   * First tries to parse Protobuf, falls back to using numbered names
   */
  private async scanForMediaFilesOnDisk(extractedDir: string): Promise<Record<string, string>> {
    // First try to parse the Protobuf media mapping
    const mediaMappingPath = `${extractedDir}media`;
    try {
      const binaryData = await FileSystem.readAsStringAsync(mediaMappingPath, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const uint8Array = this.base64ToUint8Array(binaryData);
      const protobufMapping = this.parseMediaProtobuf(uint8Array);
      if (Object.keys(protobufMapping).length > 0) {
        logger.info('[MediaExtractor] ✓ Parsed Protobuf media mapping with', Object.keys(protobufMapping).length, 'entries');
        return protobufMapping;
      }
    } catch (e) {
      logger.warn('[MediaExtractor] Failed to parse Protobuf media mapping:', e);
    }
    
    // Fallback: scan for numbered files
    const mediaMapping: Record<string, string> = {};
    
    try {
      const dirContents = await FileSystem.readDirectoryAsync(extractedDir);
      
      for (const filename of dirContents) {
        // Media files are numbered: 0, 1, 2, etc.
        if (/^\d+$/.test(filename)) {
          // Use the number as both key and filename (we don't know the real name)
          mediaMapping[filename] = `media_${filename}`;
        }
      }
      
      logger.info('[MediaExtractor] Scanned disk, found', Object.keys(mediaMapping).length, 'numbered media files (fallback)');
    } catch (e) {
      logger.error('[MediaExtractor] Failed to scan directory for media files:', e);
    }
    
    return mediaMapping;
  }

  /**
   * Parse Protobuf MediaEntries format to extract filename mapping
   * Format: repeated MediaEntry { string name = 1; uint32 size = 2; bytes sha1 = 3; }
   * Each entry corresponds to a numbered file (0, 1, 2, ...)
   */
  private parseMediaProtobuf(data: Uint8Array): Record<string, string> {
    const mapping: Record<string, string> = {};
    let offset = 0;
    let mediaIndex = 0;
    
    while (offset < data.length) {
      // Read field tag (varint)
      const tag = data[offset];
      const fieldNumber = tag >> 3;
      const wireType = tag & 0x07;
      offset++;
      
      if (offset >= data.length) break;
      
      // Field 1 with wire type 2 (length-delimited) = embedded message (MediaEntry)
      if (fieldNumber === 1 && wireType === 2) {
        // Read message length (varint)
        let messageLength = 0;
        let shift = 0;
        while (offset < data.length) {
          const byte = data[offset];
          offset++;
          messageLength |= (byte & 0x7f) << shift;
          if ((byte & 0x80) === 0) break;
          shift += 7;
        }
        
        // Parse the embedded MediaEntry message
        const messageEnd = offset + messageLength;
        let filename: string | null = null;
        
        while (offset < messageEnd && offset < data.length) {
          const innerTag = data[offset];
          const innerFieldNumber = innerTag >> 3;
          const innerWireType = innerTag & 0x07;
          offset++;
          
          if (innerFieldNumber === 1 && innerWireType === 2) {
            // Field 1 = name (string)
            let strLength = 0;
            let strShift = 0;
            while (offset < data.length) {
              const byte = data[offset];
              offset++;
              strLength |= (byte & 0x7f) << strShift;
              if ((byte & 0x80) === 0) break;
              strShift += 7;
            }
            
            // Read the string bytes
            const strBytes = data.slice(offset, offset + strLength);
            filename = new TextDecoder().decode(strBytes);
            offset += strLength;
          } else if (innerWireType === 0) {
            // Varint - skip it
            while (offset < data.length && (data[offset] & 0x80) !== 0) {
              offset++;
            }
            offset++;
          } else if (innerWireType === 2) {
            // Length-delimited - skip it
            let skipLength = 0;
            let skipShift = 0;
            while (offset < data.length) {
              const byte = data[offset];
              offset++;
              skipLength |= (byte & 0x7f) << skipShift;
              if ((byte & 0x80) === 0) break;
              skipShift += 7;
            }
            offset += skipLength;
          } else {
            // Unknown wire type, try to continue
            break;
          }
        }
        
        // Ensure we're at the end of the message
        offset = messageEnd;
        
        if (filename) {
          mapping[mediaIndex.toString()] = filename;
        }
        mediaIndex++;
      } else {
        // Skip unknown fields
        if (wireType === 0) {
          // Varint
          while (offset < data.length && (data[offset] & 0x80) !== 0) {
            offset++;
          }
          offset++;
        } else if (wireType === 2) {
          // Length-delimited
          let skipLength = 0;
          let skipShift = 0;
          while (offset < data.length) {
            const byte = data[offset];
            offset++;
            skipLength |= (byte & 0x7f) << skipShift;
            if ((byte & 0x80) === 0) break;
            skipShift += 7;
          }
          offset += skipLength;
        } else {
          // Unknown wire type, abort
          break;
        }
      }
    }
    
    logger.info('[MediaExtractor] Protobuf parser extracted', Object.keys(mapping).length, 'filenames');
    return mapping;
  }

  /**
   * Convert base64 string to Uint8Array
   * Using safe implementation that works in React Native without atob
   */
  private base64ToUint8Array(base64: string): Uint8Array {
    const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    
    // Remove padding and whitespace
    const cleanBase64 = base64.replace(/[\s=]/g, '');
    const len = cleanBase64.length;
    const outputLen = Math.floor(len * 3 / 4);
    const bytes = new Uint8Array(outputLen);
    
    let byteIndex = 0;
    for (let i = 0; i < len; i += 4) {
      const a = base64Chars.indexOf(cleanBase64[i]);
      const b = base64Chars.indexOf(cleanBase64[i + 1]);
      const c = i + 2 < len ? base64Chars.indexOf(cleanBase64[i + 2]) : 0;
      const d = i + 3 < len ? base64Chars.indexOf(cleanBase64[i + 3]) : 0;
      
      bytes[byteIndex++] = (a << 2) | (b >> 4);
      if (byteIndex < outputLen) bytes[byteIndex++] = ((b & 0x0f) << 4) | (c >> 2);
      if (byteIndex < outputLen) bytes[byteIndex++] = ((c & 0x03) << 6) | d;
    }
    
    return bytes;
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
