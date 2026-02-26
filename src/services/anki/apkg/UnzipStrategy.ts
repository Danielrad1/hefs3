/**
 * Unzip Strategy
 * Handles different methods of unzipping .apkg files
 * - Streaming unzip (expo-zip, react-native-zip-archive) for large files
 * - Memory-based unzip (JSZip) for smaller files
 */

import * as FileSystem from 'expo-file-system/legacy';
const JSZip = require('jszip');
import { decompress } from 'fzstd';
import { ApkgParseOptions, StreamingUnzipResult } from './types';
import { ProgressReporter } from './ProgressReporter';
import { logger } from '../../../utils/logger';

export class UnzipStrategy {
  private tempDir: string;

  constructor(tempDir: string) {
    this.tempDir = tempDir;
  }

  /**
   * Attempt to unzip using a native streaming unzipper.
   * Supports expo-zip and react-native-zip-archive if available at runtime.
   * Returns collection path and extracted directory when successful.
   */
  async tryStreamingUnzip(
    fileUri: string,
    options: ApkgParseOptions = {}
  ): Promise<StreamingUnzipResult | null> {
    const progress = new ProgressReporter(options);
    
    // Source and destination URIs/paths
    const srcUri = fileUri; // e.g., file:///...
    const srcFsPath = this.stripFileScheme(fileUri); // e.g., /var/... (for rn-zip-archive)

    // Destination directory unique per import (as URI)
    const extractedDir = `${this.tempDir}unzipped_${Date.now()}/`; // file:///...
    await FileSystem.makeDirectoryAsync(extractedDir, { intermediates: true });

    // Try expo-zip first
    try {
      const expoZip = this.safeRequire('expo-zip');
      if (expoZip && typeof expoZip.unzipAsync === 'function') {
        logger.info('[UnzipStrategy] Using expo-zip for streaming unzip');
        progress.report('Unzipping with expo-zip…');
        await expoZip.unzipAsync(srcUri, extractedDir);
        const collectionPath = await this.resolveCollectionPath(extractedDir);
        if (!collectionPath) throw new Error('No collection file found after expo-zip unzip');
        return { collectionPath, extractedDir };
      }
    } catch (e) {
      logger.warn('[UnzipStrategy] expo-zip unavailable or failed:', e);
    }

    // Try react-native-zip-archive next
    try {
      const rnza = this.safeRequire('react-native-zip-archive');
      if (rnza && typeof rnza.unzip === 'function') {
        logger.info('[UnzipStrategy] Using react-native-zip-archive for streaming unzip');
        progress.report('Unzipping with rn-zip-archive…');
        const destFsPath = this.stripFileScheme(extractedDir);
        logger.info('[UnzipStrategy] Unzipping from:', srcFsPath);
        logger.info('[UnzipStrategy] Unzipping to:', destFsPath);
        
        let unsubscribe: any = null;
        try {
          if (typeof rnza.subscribe === 'function') {
            unsubscribe = rnza.subscribe(({ progress: prog }: any) => {
              if (typeof prog === 'number') {
                progress.report(`Unzipping… ${Math.round(prog)}%`);
              }
            });
          }
        } catch {}
        await rnza.unzip(srcFsPath, destFsPath);
        try {
          if (unsubscribe) unsubscribe();
        } catch {}
        const collectionPath = await this.resolveCollectionPath(extractedDir);
        if (!collectionPath) throw new Error('No collection file found after rn-zip-archive unzip');
        return { collectionPath, extractedDir };
      }
    } catch (e) {
      logger.error('[UnzipStrategy] react-native-zip-archive failed with error:', e);
      logger.warn('[UnzipStrategy] Falling back to JSZip (may fail for files > 100MB)');
    }

    // Cleanup created directory if nothing worked
    try {
      await FileSystem.deleteAsync(extractedDir, { idempotent: true });
    } catch {}
    return null;
  }

  /**
   * Read and unzip file using JSZip (memory-based)
   * Works for files up to ~100MB depending on device
   */
  async readAndUnzipWithJSZip(fileUri: string, fileSizeMB: number): Promise<any> {
    logger.info('[UnzipStrategy] Reading file...');

    // Use different strategies based on file size to handle large files
    if (fileSizeMB > 100) {
      logger.info('[UnzipStrategy] Using chunked reading for large file...');
      return this.readLargeFileAsZip(fileUri, fileSizeMB);
    }

    // Prefer ArrayBuffer path even for medium files to avoid huge strings
    try {
      logger.info('[UnzipStrategy] Reading via fetch -> ArrayBuffer...');
      const res = await fetch(fileUri);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const blob = await res.blob();
      logger.info('[UnzipStrategy] Converting to ArrayBuffer...');
      const arrayBuffer = await blob.arrayBuffer();
      logger.info(
        '[UnzipStrategy] Calling JSZip.loadAsync(ArrayBuffer) byteLength=',
        (arrayBuffer as any)?.byteLength || 'unknown'
      );
      const zip = await JSZip.loadAsync(arrayBuffer);
      logger.info('[UnzipStrategy] JSZip.loadAsync(ArrayBuffer) finished');
      return zip;
    } catch (e) {
      logger.warn('[UnzipStrategy] ArrayBuffer read failed, falling back to base64', e);
      const base64Fallback = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      logger.info('[UnzipStrategy] Calling JSZip.loadAsync(base64) length=', base64Fallback.length);
      const zip = await JSZip.loadAsync(base64Fallback, { base64: true });
      logger.info('[UnzipStrategy] JSZip.loadAsync(base64) finished');
      return zip;
    }
  }

  /**
   * Read large files by rejecting them with a helpful message
   * Unfortunately, React Native/JavaScript has fundamental limits for very large files
   */
  private async readLargeFileAsZip(fileUri: string, fileSizeMB: number): Promise<any> {
    logger.info('[UnzipStrategy] Attempting to read large file with memory management...');

    // Try ArrayBuffer path first to avoid giant strings
    try {
      logger.info('[UnzipStrategy] Reading large file using fetch API...');
      const res: any = await fetch(fileUri);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      // Prefer Response.arrayBuffer if available in this RN runtime
      let arrayBuffer: ArrayBuffer;
      if (typeof res.arrayBuffer === 'function') {
        logger.info('[UnzipStrategy] Using Response.arrayBuffer()');
        arrayBuffer = await res.arrayBuffer();
      } else if (typeof res.blob === 'function') {
        const blob: any = await res.blob();
        if (blob && typeof blob.arrayBuffer === 'function') {
          logger.info('[UnzipStrategy] Converting Blob to ArrayBuffer...');
          arrayBuffer = await blob.arrayBuffer();
        } else {
          throw new Error('Blob.arrayBuffer not supported in this environment');
        }
      } else {
        throw new Error('Response.arrayBuffer/Blob not supported in this environment');
      }
      logger.info('[UnzipStrategy] Loading ZIP from ArrayBuffer...');
      const zip = await JSZip.loadAsync(arrayBuffer);
      logger.info('[UnzipStrategy] Large file loaded successfully (ArrayBuffer path)');
      return zip;
    } catch (arrayBufferErr) {
      logger.warn('[UnzipStrategy] ArrayBuffer path failed, trying base64 fallback...', arrayBufferErr);

      try {
        logger.info('[UnzipStrategy] Reading as base64 fallback...');
        const base64 = await FileSystem.readAsStringAsync(fileUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        logger.info('[UnzipStrategy] Base64 length:', (base64.length / (1024 * 1024)).toFixed(2), 'MB');
        logger.info('[UnzipStrategy] Loading ZIP from base64...');
        const zip = await JSZip.loadAsync(base64, { base64: true });
        logger.info('[UnzipStrategy] Large file loaded successfully (base64 fallback)');
        return zip;
      } catch (error) {
        logger.error('[UnzipStrategy] Error reading large file:', error);

        if (
          error instanceof Error &&
          (error.message.includes('String length') ||
            error.message.includes('Maximum string length') ||
            error.message.includes('RangeError'))
        ) {
          throw new Error(
            `File too large to process (${fileSizeMB.toFixed(1)}MB). The file exceeds JavaScript's string length limit.\n\nThis is a fundamental limitation of JavaScript on mobile devices.\n\nSolutions:\n• Split your deck into smaller files (<100MB each)\n• Use Anki desktop to create smaller exports\n• Remove large media files and import them separately\n• Import on a device with more available memory`
          );
        }

        throw new Error(
          `Failed to process large file: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  }

  /**
   * Extract collection file from JSZip archive and write to disk
   */
  async extractCollectionFromZip(zip: any): Promise<string> {
    // Try collection.anki21b first (Zstandard-compressed), then anki21, then anki2
    logger.info('[UnzipStrategy] ========== EXTRACTING COLLECTION FILE ==========');
    logger.info('[UnzipStrategy] Checking for collection files in ZIP archive...');
    
    // List all files in the ZIP for debugging
    const zipFiles = Object.keys(zip.files);
    logger.info('[UnzipStrategy] Files in ZIP:', zipFiles);
    
    let collectionFile = zip.file('collection.anki21b');
    let isCompressed = false;
    
    if (collectionFile) {
      logger.info('[UnzipStrategy] ✓ Found collection.anki21b (Zstandard-compressed format)');
      isCompressed = true;
    } else {
      logger.info('[UnzipStrategy] ✗ collection.anki21b not found');
      collectionFile = zip.file('collection.anki21');
      if (collectionFile) {
        logger.info('[UnzipStrategy] ✓ Found collection.anki21 (Anki 2.1 format)');
      } else {
        logger.info('[UnzipStrategy] ✗ collection.anki21 not found, trying collection.anki2');
        collectionFile = zip.file('collection.anki2');
        if (!collectionFile) {
          logger.error('[UnzipStrategy] ✗ No collection file found in .apkg');
          logger.error('[UnzipStrategy] Available files:', zipFiles);
          throw new Error('No collection file found in .apkg');
        }
        logger.info('[UnzipStrategy] ✓ Found collection.anki2 (legacy format)');
      }
    }

    let collectionBase64: string;
    
    if (isCompressed) {
      // Extract compressed data as Uint8Array, decompress, then convert to base64
      try {
        logger.info('[UnzipStrategy] ========== DECOMPRESSION FLOW ==========');
        logger.info('[UnzipStrategy] Step 1: Extracting compressed collection as Uint8Array…');
        const compressedData = await collectionFile.async('uint8array');
        logger.info('[UnzipStrategy] ✓ Compressed size:', compressedData.length, 'bytes', `(${(compressedData.length / 1024 / 1024).toFixed(2)} MB)`);
        
        // Check first few bytes to verify it's zstd compressed
        const magic = compressedData.slice(0, 4);
        logger.info('[UnzipStrategy] First 4 bytes (magic number):', Array.from(magic).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
        logger.info('[UnzipStrategy] Expected zstd magic: 0x28 0xb5 0x2f 0xfd');
        
        logger.info('[UnzipStrategy] Step 2: Decompressing with Zstandard (fzstd)…');
        const startTime = Date.now();
        const decompressed = decompress(compressedData);
        const decompressTime = Date.now() - startTime;
        logger.info('[UnzipStrategy] ✓ Decompressed size:', decompressed.length, 'bytes', `(${(decompressed.length / 1024 / 1024).toFixed(2)} MB)`);
        logger.info('[UnzipStrategy] ✓ Decompression took:', decompressTime, 'ms');
        logger.info('[UnzipStrategy] Compression ratio:', (compressedData.length / decompressed.length * 100).toFixed(1) + '%');
        
        // Verify SQLite header
        const header = String.fromCharCode(...decompressed.slice(0, 16));
        logger.info('[UnzipStrategy] Decompressed file header:', header);
        if (!header.startsWith('SQLite format 3')) {
          logger.error('[UnzipStrategy] ✗ Invalid SQLite header after decompression!');
          logger.error('[UnzipStrategy] Expected: "SQLite format 3", got:', header);
          throw new Error('Decompressed data is not a valid SQLite database');
        }
        logger.info('[UnzipStrategy] ✓ Valid SQLite header confirmed');
        
        // Convert decompressed Uint8Array to base64
        logger.info('[UnzipStrategy] Step 3: Converting to base64…');
        collectionBase64 = this.uint8ArrayToBase64(decompressed);
        logger.info('[UnzipStrategy] ✓ Base64 length:', collectionBase64.length, 'chars');
      } catch (e) {
        logger.error('[UnzipStrategy] ========== DECOMPRESSION FAILED ==========');
        logger.error('[UnzipStrategy] Error type:', e instanceof Error ? e.constructor.name : typeof e);
        logger.error('[UnzipStrategy] Error message:', e instanceof Error ? e.message : String(e));
        logger.error('[UnzipStrategy] Error stack:', e instanceof Error ? e.stack : 'N/A');
        throw new Error(
          `Failed to decompress collection.anki21b: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    } else {
      // Extract as base64 directly (avoids ZIP-wide string, but still creates a large string for the DB)
      try {
        logger.info('[UnzipStrategy] ========== LEGACY EXTRACTION FLOW ==========');
        logger.info('[UnzipStrategy] Extracting uncompressed collection as base64…');
        collectionBase64 = await collectionFile.async('base64');
        logger.info('[UnzipStrategy] ✓ Extracted base64 length:', collectionBase64.length, 'chars');
      } catch (e) {
        logger.error('[UnzipStrategy] ========== EXTRACTION FAILED ==========');
        logger.error('[UnzipStrategy] Error:', e);
        throw new Error(
          'Failed to extract collection from archive. On very large decks, enable streaming unzip (expo-zip or react-native-zip-archive) to avoid huge base64 strings.'
        );
      }
    }

    logger.info('[UnzipStrategy] ========== WRITING TO DISK ==========');
    const collectionPath = `${this.tempDir}collection.anki2`;
    logger.info('[UnzipStrategy] Target path:', collectionPath);

    // Write SQLite file from base64
    logger.info('[UnzipStrategy] Writing base64 to file…');
    await FileSystem.writeAsStringAsync(collectionPath, collectionBase64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    logger.info('[UnzipStrategy] ✓ Write complete');

    // Verify file was written
    const writtenInfo = await FileSystem.getInfoAsync(collectionPath);
    logger.info('[UnzipStrategy] File exists:', writtenInfo.exists);
    if (writtenInfo.exists && !writtenInfo.isDirectory) {
      const size = (writtenInfo as any).size || 0;
      logger.info('[UnzipStrategy] File size:', size, 'bytes', `(${(size / 1024 / 1024).toFixed(2)} MB)`);
    }

    // Decode first 16 bytes using the already available base64 string to verify SQLite header
    // SQLite files start with "SQLite format 3\0" (hex: 53 51 4c 69 74 65 20 66 6f 72 6d 61 74 20 33 00)
    logger.info('[UnzipStrategy] Verifying SQLite header…');
    logger.info('[UnzipStrategy] First 50 chars of base64:', collectionBase64.substring(0, 50));
    const headerBase64 = collectionBase64.substring(0, 24); // ~16 bytes in base64
    const headerBinary = this.base64DecodeHeader(headerBase64);
    logger.info('[UnzipStrategy] First 16 bytes as string:', JSON.stringify(headerBinary));
    logger.info('[UnzipStrategy] Expected: "SQLite format 3"');
    
    if (headerBinary.startsWith('SQLite format 3')) {
      logger.info('[UnzipStrategy] ✓ SQLite header verified');
    } else {
      logger.error('[UnzipStrategy] ✗ Invalid SQLite header!');
    }
    
    logger.info('[UnzipStrategy] ========== EXTRACTION COMPLETE ==========');
    return collectionPath;
  }

  private stripFileScheme(uri: string): string {
    return uri.startsWith('file://') ? uri.replace('file://', '') : uri;
  }

  private safeRequire(moduleId: string): any | null {
    try {
      if (moduleId === 'react-native-zip-archive') {
        // Direct import to ensure bundler includes it
        return require('react-native-zip-archive');
      }
      return null;
    } catch (e) {
      logger.info('[UnzipStrategy] Failed to require', moduleId, ':', e);
      return null;
    }
  }

  private async resolveCollectionPath(dir: string): Promise<string | null> {
    // Check for collection.anki21b (Zstandard-compressed) first
    const p0 = `${dir}collection.anki21b`;
    const i0 = await FileSystem.getInfoAsync(p0);
    if (i0.exists && !i0.isDirectory) {
      // Decompress and return path to decompressed file
      return await this.decompressCollectionFile(p0, dir);
    }

    const p1 = `${dir}collection.anki21`;
    const i1 = await FileSystem.getInfoAsync(p1);
    if (i1.exists && !i1.isDirectory) return p1;

    const p2 = `${dir}collection.anki2`;
    const i2 = await FileSystem.getInfoAsync(p2);
    if (i2.exists && !i2.isDirectory) return p2;
    return null;
  }

  /**
   * Decompress a collection.anki21b file and return path to decompressed file
   */
  private async decompressCollectionFile(compressedPath: string, dir: string): Promise<string> {
    logger.info('[UnzipStrategy] ========== STREAMING DECOMPRESSION ==========');
    logger.info('[UnzipStrategy] Decompressing collection.anki21b from streaming unzip...');
    logger.info('[UnzipStrategy] Source:', compressedPath);
    
    try {
      // Check file exists
      const fileInfo = await FileSystem.getInfoAsync(compressedPath);
      logger.info('[UnzipStrategy] File exists:', fileInfo.exists);
      if (fileInfo.exists && !fileInfo.isDirectory) {
        const size = (fileInfo as any).size || 0;
        logger.info('[UnzipStrategy] Compressed file size:', size, 'bytes', `(${(size / 1024 / 1024).toFixed(2)} MB)`);
      }
      
      // Read compressed file as base64
      logger.info('[UnzipStrategy] Reading compressed file as base64…');
      const compressedBase64 = await FileSystem.readAsStringAsync(compressedPath, {
        encoding: FileSystem.EncodingType.Base64,
      });
      logger.info('[UnzipStrategy] ✓ Read base64, length:', compressedBase64.length, 'chars');
      
      // Convert base64 to Uint8Array
      logger.info('[UnzipStrategy] Converting base64 to Uint8Array…');
      const compressedData = this.base64ToUint8Array(compressedBase64);
      logger.info('[UnzipStrategy] ✓ Compressed size:', compressedData.length, 'bytes');
      
      // Check magic number
      const magic = compressedData.slice(0, 4);
      logger.info('[UnzipStrategy] Magic number:', Array.from(magic).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
      
      // Decompress with Zstandard
      logger.info('[UnzipStrategy] Decompressing with fzstd…');
      const startTime = Date.now();
      const decompressed = decompress(compressedData);
      const decompressTime = Date.now() - startTime;
      logger.info('[UnzipStrategy] ✓ Decompressed size:', decompressed.length, 'bytes', `(${(decompressed.length / 1024 / 1024).toFixed(2)} MB)`);
      logger.info('[UnzipStrategy] ✓ Decompression took:', decompressTime, 'ms');
      
      // Verify SQLite header
      const header = String.fromCharCode(...decompressed.slice(0, 16));
      logger.info('[UnzipStrategy] Decompressed header:', JSON.stringify(header));
      if (!header.startsWith('SQLite format 3')) {
        logger.error('[UnzipStrategy] ✗ Invalid SQLite header!');
        throw new Error('Decompressed data is not a valid SQLite database');
      }
      logger.info('[UnzipStrategy] ✓ Valid SQLite header');
      
      // Write decompressed data to new file
      const decompressedPath = `${dir}collection.anki21`;
      logger.info('[UnzipStrategy] Writing decompressed file to:', decompressedPath);
      const decompressedBase64 = this.uint8ArrayToBase64(decompressed);
      await FileSystem.writeAsStringAsync(decompressedPath, decompressedBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      logger.info('[UnzipStrategy] ✓ Decompressed file written successfully');
      logger.info('[UnzipStrategy] ========== STREAMING DECOMPRESSION COMPLETE ==========');
      return decompressedPath;
    } catch (e) {
      logger.error('[UnzipStrategy] ========== STREAMING DECOMPRESSION FAILED ==========');
      logger.error('[UnzipStrategy] Error type:', e instanceof Error ? e.constructor.name : typeof e);
      logger.error('[UnzipStrategy] Error message:', e instanceof Error ? e.message : String(e));
      logger.error('[UnzipStrategy] Error stack:', e instanceof Error ? e.stack : 'N/A');
      throw new Error(
        `Failed to decompress collection.anki21b: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }

  /**
   * Decode base64 string to check SQLite header
   */
  private base64DecodeHeader(base64: string): string {
    const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let result = '';
    const len = Math.min(24, base64.length); // Only decode first 24 chars (~16 bytes)

    for (let i = 0; i < len; i += 4) {
      const idx1 = base64Chars.indexOf(base64[i]);
      const idx2 = base64Chars.indexOf(base64[i + 1]);
      const idx3 = base64Chars.indexOf(base64[i + 2]);
      const idx4 = base64Chars.indexOf(base64[i + 3]);

      if (idx1 === -1 || idx2 === -1) break;

      const byte1 = (idx1 << 2) | (idx2 >> 4);
      result += String.fromCharCode(byte1);

      if (idx3 !== -1) {
        const byte2 = ((idx2 & 0x0f) << 4) | (idx3 >> 2);
        result += String.fromCharCode(byte2);
      }

      if (idx4 !== -1) {
        const byte3 = ((idx3 & 0x03) << 6) | idx4;
        result += String.fromCharCode(byte3);
      }
    }

    return result;
  }

  /**
   * Convert Uint8Array to base64 string
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

  /**
   * Convert base64 string to Uint8Array
   */
  private base64ToUint8Array(base64: string): Uint8Array {
    const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const len = base64.length;
    const bytes: number[] = [];

    for (let i = 0; i < len; i += 4) {
      const idx1 = base64Chars.indexOf(base64[i]);
      const idx2 = base64Chars.indexOf(base64[i + 1]);
      const idx3 = base64Chars.indexOf(base64[i + 2]);
      const idx4 = base64Chars.indexOf(base64[i + 3]);

      if (idx1 === -1 || idx2 === -1) break;

      const byte1 = (idx1 << 2) | (idx2 >> 4);
      bytes.push(byte1);

      if (idx3 !== -1 && base64[i + 2] !== '=') {
        const byte2 = ((idx2 & 0x0f) << 4) | (idx3 >> 2);
        bytes.push(byte2);
      }

      if (idx4 !== -1 && base64[i + 3] !== '=') {
        const byte3 = ((idx3 & 0x03) << 6) | idx4;
        bytes.push(byte3);
      }
    }

    return new Uint8Array(bytes);
  }
}
