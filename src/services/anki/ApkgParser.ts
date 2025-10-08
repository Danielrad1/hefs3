/**
 * .apkg Parser
 * Extracts and parses Anki .apkg files
 */

import * as FileSystem from 'expo-file-system/legacy';
const JSZip = require('jszip');
import * as SQLite from 'expo-sqlite';
import { AnkiCard, AnkiNote, AnkiCol, Deck, DeckConfig, AnkiRevlog } from './schema';

export interface ApkgParseResult {
  col: AnkiCol;
  cards: AnkiCard[];
  notes: AnkiNote[];
  decks: Map<string, Deck>;
  deckConfigs: Map<string, DeckConfig>;
  mediaFiles: Map<string, string>; // mediaId -> filename
  revlog: AnkiRevlog[]; // Review history for progress preservation
}

export interface ApkgParseOptions {
  // Enable native streaming unzip (requires expo-zip or react-native-zip-archive)
  enableStreaming?: boolean;
  // Report human-readable progress strings to the UI
  onProgress?: (message: string) => void;
}

export class ApkgParser {
  private tempDir = `${FileSystem.documentDirectory}temp/`;
  private mediaDir = `${FileSystem.documentDirectory}media/`;

  /**
   * Parse an .apkg file from a URI
   */
  async parse(fileUri: string, options: ApkgParseOptions = {}): Promise<ApkgParseResult> {
    console.log('[ApkgParser] Starting parse:', fileUri);
    const onProgress = (msg: string) => {
      try {
        options.onProgress?.(msg);
      } catch {}
    };

    // Check file size first
    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    if (!fileInfo.exists) {
      throw new Error('File does not exist');
    }
    
    const fileSizeMB = fileInfo.size ? fileInfo.size / (1024 * 1024) : 0;
    console.log('[ApkgParser] File size:', fileSizeMB.toFixed(2), 'MB');
    
    // Warn about very large files but don't block them
    if (fileSizeMB > 500) {
      console.warn('[ApkgParser] Very large file detected:', fileSizeMB.toFixed(2), 'MB - this will take significant time and memory');
    } else if (fileSizeMB > 100) {
      console.warn('[ApkgParser] Large file detected:', fileSizeMB.toFixed(2), 'MB - this may take a while');
    }

    // Ensure directories exist
    await this.ensureDirectories();

    // Streaming unzip feature flag (fallback path for huge files)
    const useStreaming = options.enableStreaming === true;
    try {
      const hasExpoZip = !!this.safeRequire('expo-zip');
      const hasRnZipArchive = !!this.safeRequire('react-native-zip-archive');
      console.log('[ApkgParser] Streaming requested:', useStreaming, '| expo-zip:', hasExpoZip, '| rn-zip-archive:', hasRnZipArchive);
    } catch {}

    // No hard guard: attempt streaming or fallbacks for any size

    // If streaming is enabled, try native unzip first. This keeps memory low.
    if (useStreaming) {
      onProgress('Unzipping (streaming)…');
      const streamed = await this.tryStreamingUnzip(fileUri, options);
      if (streamed) {
        // We have extracted files on disk; proceed without JSZip
        const { collectionPath, extractedDir } = streamed;
        console.log('[ApkgParser] Streaming unzip path active. Collection at:', collectionPath);

        // Parse SQLite
        console.log('[ApkgParser] Parsing SQLite database (streaming path)...');
        onProgress('Parsing database…');
        const result = await this.parseSQLite(collectionPath);

        // Extract media by moving/copying from extracted dir
        console.log('[ApkgParser] Extracting media files (streaming path)...');
        onProgress('Placing media files…');
        const mediaMap = await this.extractMediaFromFs(extractedDir, options);
        result.mediaFiles = mediaMap;

        // Best-effort cleanup of extracted dir
        try { await FileSystem.deleteAsync(extractedDir, { idempotent: true }); } catch {}

        console.log('[ApkgParser] Parse complete (streaming path)!');
        onProgress('Completed');
        return result;
      } else {
        console.log('[ApkgParser] Streaming unzip not available; falling back to JSZip path.');
      }
    }

    let zip: any;
    try {
      // Read file as base64 with size check
      console.log('[ApkgParser] Reading file...');
      onProgress('Reading file…');
      
      // Use different strategies based on file size to handle large files
      if (fileSizeMB > 100) {
        console.log('[ApkgParser] Using chunked reading for large file...');
        zip = await this.readLargeFileAsZip(fileUri, fileSizeMB);
      } else {
        // Prefer ArrayBuffer path even for medium files to avoid huge strings
        try {
          console.log('[ApkgParser] Reading via fetch -> ArrayBuffer...');
          const res = await fetch(fileUri);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
          }
          const blob = await res.blob();
          console.log('[ApkgParser] Converting to ArrayBuffer...');
          const arrayBuffer = await blob.arrayBuffer();
          console.log('[ApkgParser] Calling JSZip.loadAsync(ArrayBuffer) byteLength=', (arrayBuffer as any)?.byteLength || 'unknown');
          zip = await JSZip.loadAsync(arrayBuffer);
          console.log('[ApkgParser] JSZip.loadAsync(ArrayBuffer) finished');
        } catch (e) {
          console.warn('[ApkgParser] ArrayBuffer read failed, falling back to base64', e);
          const base64Fallback = await FileSystem.readAsStringAsync(fileUri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          console.log('[ApkgParser] Calling JSZip.loadAsync(base64) length=', base64Fallback.length);
          zip = await JSZip.loadAsync(base64Fallback, { base64: true });
          console.log('[ApkgParser] JSZip.loadAsync(base64) finished');
        }
      }
      
      console.log('[ApkgParser] File loaded successfully');
      onProgress('Processing archive…');
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('String length') || error.message.includes('Maximum string length')) {
          throw new Error(`File too large to process. The file exceeds JavaScript's string length limit. Try importing a smaller deck or splitting the deck into multiple files.`);
        }
        throw new Error(`Failed to read file: ${error.message}`);
      }
      throw new Error('Failed to read file: Unknown error');
    }

    // Unzip
    console.log('[ApkgParser] Processing archive...');

    // Try collection.anki21 first (newer format), fall back to collection.anki2
    console.log('[ApkgParser] Checking for collection files...');
    let collectionFile = zip.file('collection.anki21');
    if (collectionFile) {
      console.log('[ApkgParser] Using collection.anki21 (Anki 2.1 format)');
    } else {
      console.log('[ApkgParser] collection.anki21 not found, trying collection.anki2');
      collectionFile = zip.file('collection.anki2');
      if (!collectionFile) {
        throw new Error('No collection file found in .apkg');
      }
      console.log('[ApkgParser] Using collection.anki2 (legacy format)');
    }

    // Extract as base64 directly (avoids ZIP-wide string, but still creates a large string for the DB)
    let collectionBase64: string;
    try {
      console.log('[ApkgParser] Extracting collection as base64…');
      collectionBase64 = await collectionFile.async('base64');
      console.log('[ApkgParser] Extracted base64 length:', collectionBase64.length);
    } catch (e) {
      console.error('[ApkgParser] Error extracting collection as base64:', e);
      throw new Error('Failed to extract collection from archive. On very large decks, enable streaming unzip (expo-zip or react-native-zip-archive) to avoid huge base64 strings.');
    }

    const collectionPath = `${this.tempDir}collection.anki2`;
    console.log('[ApkgParser] Writing to:', collectionPath);

    // Write SQLite file from base64
    onProgress('Writing database file…');
    await FileSystem.writeAsStringAsync(
      collectionPath,
      collectionBase64,
      { encoding: FileSystem.EncodingType.Base64 }
    );
    console.log('[ApkgParser] Write complete');

    // Verify file was written
    const writtenInfo = await FileSystem.getInfoAsync(collectionPath);
    console.log('[ApkgParser] File written, exists:', writtenInfo.exists);

    // Decode first 16 bytes using the already available base64 string to verify SQLite header
    // SQLite files start with "SQLite format 3\0" (hex: 53 51 4c 69 74 65 20 66 6f 72 6d 61 74 20 33 00)
    console.log('[ApkgParser] First 50 chars of base64:', collectionBase64.substring(0, 50));
    const headerBase64 = collectionBase64.substring(0, 24); // ~16 bytes in base64
    const headerBinary = this.base64DecodeHeader(headerBase64);
    console.log('[ApkgParser] First 16 bytes as string:', headerBinary);
    console.log('[ApkgParser] Expected: "SQLite format 3"');

    // Parse SQLite
    console.log('[ApkgParser] Parsing SQLite database...');
    onProgress('Parsing database…');
    const result = await this.parseSQLite(collectionPath);

    // Extract media
    console.log('[ApkgParser] Extracting media files...');
    onProgress('Extracting media…');
    const mediaMap = await this.extractMedia(zip, options);
    result.mediaFiles = mediaMap;

    console.log('[ApkgParser] Parse complete!');
    onProgress('Completed');
    return result;
  }

  /**
   * Parse the collection.anki2 SQLite database
   */
  private async parseSQLite(dbPath: string): Promise<ApkgParseResult> {
    console.log('[ApkgParser] Opening database at:', dbPath);
    
    // Check if file exists
    const fileInfo = await FileSystem.getInfoAsync(dbPath);
    console.log('[ApkgParser] File exists:', fileInfo.exists);
    
    // expo-sqlite might not support arbitrary paths, copy to SQLiteDatabase directory
    const sqliteDir = `${FileSystem.documentDirectory}SQLite/`;
    await FileSystem.makeDirectoryAsync(sqliteDir, { intermediates: true });
    const dbName = 'imported_collection.db';
    const dbInSqliteDir = `${sqliteDir}${dbName}`;
    
    console.log('[ApkgParser] Copying to SQLite directory:', dbInSqliteDir);
    await FileSystem.copyAsync({
      from: dbPath,
      to: dbInSqliteDir,
    });
    
    // Open database by name (relative to SQLite directory)
    const db = await SQLite.openDatabaseAsync(dbName);
    console.log('[ApkgParser] Database opened successfully');

    try {
      // Check what tables exist
      const tables = await db.getAllAsync<any>(
        "SELECT name FROM sqlite_master WHERE type='table'"
      );
      console.log('[ApkgParser] Tables in database:', tables);
      
      // Read collection
      const colRow = await db.getFirstAsync<any>('SELECT * FROM col');
      if (!colRow) {
        throw new Error('No collection row found');
      }

      const col: AnkiCol = {
        id: colRow.id.toString(),
        crt: colRow.crt,
        mod: colRow.mod,
        scm: colRow.scm,
        ver: colRow.ver,
        dty: colRow.dty,
        usn: colRow.usn,
        ls: colRow.ls,
        conf: colRow.conf,
        models: colRow.models,
        decks: colRow.decks,
        dconf: colRow.dconf,
        tags: colRow.tags,
      };

      // Parse decks
      const decksJson = JSON.parse(col.decks);
      const decks = new Map<string, Deck>();
      Object.entries(decksJson).forEach(([id, deck]: [string, any]) => {
        decks.set(id, {
          id: deck.id.toString(),
          name: deck.name,
          desc: deck.desc || '',
          conf: deck.conf.toString(),
          mod: deck.mod,
          usn: deck.usn,
          collapsed: deck.collapsed || false,
          browserCollapsed: deck.browserCollapsed || false,
        });
      });

      // Parse deck configs
      const dconfJson = JSON.parse(col.dconf);
      const deckConfigs = new Map<string, DeckConfig>();
      Object.entries(dconfJson).forEach(([id, conf]: [string, any]) => {
        deckConfigs.set(id, {
          id: conf.id.toString(),
          name: conf.name,
          new: {
            delays: conf.new.delays,
            ints: conf.new.ints,
            initialFactor: conf.new.initialFactor,
            perDay: conf.new.perDay,
            order: conf.new.order,
          },
          rev: {
            perDay: conf.rev.perDay,
            ease4: conf.rev.ease4,
            ivlFct: conf.rev.ivlFct || 1.0,
            maxIvl: conf.rev.maxIvl,
            fuzz: conf.rev.fuzz || 0.05,
          },
          lapse: {
            delays: conf.lapse.delays,
            mult: conf.lapse.mult,
            minInt: conf.lapse.minInt,
            leechAction: conf.lapse.leechAction || 0,
            leechFails: conf.lapse.leechFails || 8,
          },
          dyn: conf.dyn || false,
          usn: conf.usn,
          mod: conf.mod,
        });
      });

      // Read notes
      const notesRows = await db.getAllAsync<any>('SELECT * FROM notes');
      console.log('[ApkgParser] Found', notesRows.length, 'notes in database');
      notesRows.forEach((row, i) => {
        console.log(`[ApkgParser] Note ${i}:`, {
          id: row.id,
          mid: row.mid,
          flds: row.flds?.substring(0, 100), // First 100 chars
        });
      });
      
      const notes: AnkiNote[] = notesRows.map((row) => ({
        id: row.id.toString(),
        guid: row.guid,
        mid: row.mid.toString(),
        mod: row.mod,
        usn: row.usn,
        tags: row.tags,
        flds: row.flds,
        sfld: row.sfld,
        csum: row.csum,
        flags: row.flags,
        data: row.data || '',
      }));

      // Read cards
      const cardsRows = await db.getAllAsync<any>('SELECT * FROM cards');
      console.log('[ApkgParser] Found', cardsRows.length, 'cards in database');
      cardsRows.forEach((row, i) => {
        console.log(`[ApkgParser] Card ${i}:`, {
          id: row.id,
          nid: row.nid,
          did: row.did,
          ord: row.ord,
          type: row.type,
          queue: row.queue,
        });
      });
      
      const cards: AnkiCard[] = cardsRows.map((row) => ({
        id: row.id.toString(),
        nid: row.nid.toString(),
        did: row.did.toString(),
        ord: row.ord,
        mod: row.mod,
        usn: row.usn,
        type: row.type,
        queue: row.queue,
        due: row.due,
        ivl: row.ivl,
        factor: row.factor,
        reps: row.reps,
        lapses: row.lapses,
        left: row.left,
        odue: row.odue,
        odid: row.odid.toString(),
        flags: row.flags,
        data: row.data || '',
      }));

      // Read revlog (review history)
      let revlog: AnkiRevlog[] = [];
      try {
        const revlogRows = await db.getAllAsync<any>('SELECT * FROM revlog');
        console.log('[ApkgParser] Found', revlogRows.length, 'review history entries');
        revlog = revlogRows.map((row) => ({
          id: row.id.toString(),
          cid: row.cid.toString(),
          usn: row.usn,
          ease: row.ease,
          ivl: row.ivl,
          lastIvl: row.lastIvl,
          factor: row.factor,
          time: row.time,
          type: row.type,
        }));
      } catch (error) {
        console.log('[ApkgParser] No revlog table found or error reading it:', error);
        // Some .apkg files might not have revlog, that's okay
      }

      return { col, cards, notes, decks, deckConfigs, mediaFiles: new Map(), revlog };
    } finally {
      await db.closeAsync();
    }
  }

  /**
   * Sanitize filename to prevent path traversal and ensure safe characters
   * Strips all path components and ensures no directory separators remain
   */
  private sanitizeFilename(filename: string): string {
    // Strip all path components - keep only the basename
    // This handles both / and \ separators
    const basename = filename.split(/[/\\]/).pop() || '';
    
    // Remove any remaining path traversal attempts
    let sanitized = basename.replace(/\.\./g, '');
    
    // Replace all unsafe characters with underscore
    // Allow ONLY: alphanumeric, dot, dash, underscore
    // This ensures / and \ are also replaced
    sanitized = sanitized.replace(/[^A-Za-z0-9._-]/g, '_');
    
    // Final safety check: assert no path separators remain
    if (sanitized.includes('/') || sanitized.includes('\\')) {
      throw new Error(`Filename sanitization failed: path separators remain in "${sanitized}"`);
    }
    
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
   * Extract media files from the .apkg
   */
  private async extractMedia(zip: any, options: ApkgParseOptions = {}): Promise<Map<string, string>> {
    const mediaMap = new Map<string, string>();

    // Check for media file (JSON mapping)
    const mediaFile = zip.file('media');
    if (!mediaFile) {
      console.log('[ApkgParser] No media file found in .apkg');
      return mediaMap;
    }

    const mediaJson = await mediaFile.async('string');
    console.log('[ApkgParser] Media mapping:', mediaJson);
    const mediaMapping = JSON.parse(mediaJson) as Record<string, string>;
    console.log('[ApkgParser] Found', Object.keys(mediaMapping).length, 'media files to extract');

    // Extract each media file
    const entries = Object.entries(mediaMapping);
    let index = 0;
    for (const [id, filename] of entries) {
      index++;
      const file = zip.file(id);
      if (file) {
        // Sanitize filename to prevent path traversal attacks
        const sanitizedFilename = this.sanitizeFilename(filename);
        if (sanitizedFilename !== filename) {
          console.warn(`[ApkgParser] Sanitized filename from "${filename}" to "${sanitizedFilename}"`);
        }
        
        const blob = await file.async('uint8array');
        const destPath = `${this.mediaDir}${sanitizedFilename}`;
        
        console.log(`[ApkgParser] Writing media file: ${sanitizedFilename} to ${destPath}`);
        await FileSystem.writeAsStringAsync(
          destPath,
          this.uint8ArrayToBase64(blob),
          { encoding: FileSystem.EncodingType.Base64 }
        );
        if (index % 25 === 0) {
          options.onProgress?.(`Extracting media… (${index}/${entries.length})`);
        }

        // Verify file was written
        const fileInfo = await FileSystem.getInfoAsync(destPath);
        const size = fileInfo.exists && !fileInfo.isDirectory ? (fileInfo as any).size : 0;
        console.log(`[ApkgParser] Media file written: ${sanitizedFilename}, exists: ${fileInfo.exists}, size: ${size}`);

        mediaMap.set(id, sanitizedFilename);
      } else {
        console.warn(`[ApkgParser] Media file ${id} (${filename}) not found in zip`);
      }
    }

    console.log(`[ApkgParser] Extracted ${mediaMap.size} media files to ${this.mediaDir}`);
    return mediaMap;
  }

  /**
   * Extract media files from filesystem (streaming unzip path)
   * Uses direct copy/move to avoid large base64 strings
   */
  private async extractMediaFromFs(extractedDir: string, options: ApkgParseOptions = {}): Promise<Map<string, string>> {
    const mediaMap = new Map<string, string>();

    // media mapping JSON lives at <extractedDir>/media
    const mediaMappingPath = `${extractedDir}media`;
    const info = await FileSystem.getInfoAsync(mediaMappingPath);
    if (!info.exists) {
      console.log('[ApkgParser] No media file found in extracted folder');
      return mediaMap;
    }

    const mediaJson = await FileSystem.readAsStringAsync(mediaMappingPath);
    console.log('[ApkgParser] Media mapping (fs):', mediaJson);
    const mediaMapping = JSON.parse(mediaJson) as Record<string, string>;
    console.log('[ApkgParser] Found', Object.keys(mediaMapping).length, 'media files to move');

    const entries = Object.entries(mediaMapping);
    let index = 0;
    for (const [id, filename] of entries) {
      index++;
      const srcPath = `${extractedDir}${id}`;
      const srcInfo = await FileSystem.getInfoAsync(srcPath);
      if (!srcInfo.exists || srcInfo.isDirectory) {
        console.warn(`[ApkgParser] Media file ${id} (${filename}) not found on disk after unzip`);
        continue;
      }

      const sanitizedFilename = this.sanitizeFilename(filename);
      if (sanitizedFilename !== filename) {
        console.warn(`[ApkgParser] Sanitized filename from "${filename}" to "${sanitizedFilename}"`);
      }

      const destPath = `${this.mediaDir}${sanitizedFilename}`;
      try {
        // Prefer move to avoid doubling storage usage
        await FileSystem.moveAsync({ from: srcPath, to: destPath });
      } catch (e) {
        console.warn('[ApkgParser] moveAsync failed, falling back to copyAsync', e);
        await FileSystem.copyAsync({ from: srcPath, to: destPath });
      }

      const writtenInfo = await FileSystem.getInfoAsync(destPath);
      const size = writtenInfo.exists && !writtenInfo.isDirectory ? (writtenInfo as any).size : 0;
      console.log(`[ApkgParser] Media file placed: ${sanitizedFilename}, exists: ${writtenInfo.exists}, size: ${size}`);

      mediaMap.set(id, sanitizedFilename);
      if (index % 25 === 0) {
        options.onProgress?.(`Placing media… (${index}/${entries.length})`);
      }
    }

    console.log(`[ApkgParser] Extracted ${mediaMap.size} media files to ${this.mediaDir} (fs move)`);
    return mediaMap;
  }

  /**
   * Ensure required directories exist
   */
  private async ensureDirectories(): Promise<void> {
    const tempInfo = await FileSystem.getInfoAsync(this.tempDir);
    if (!tempInfo.exists) {
      await FileSystem.makeDirectoryAsync(this.tempDir, { intermediates: true });
    }

    const mediaInfo = await FileSystem.getInfoAsync(this.mediaDir);
    if (!mediaInfo.exists) {
      await FileSystem.makeDirectoryAsync(this.mediaDir, { intermediates: true });
    }
  }

  /**
   * Attempt to unzip using a native streaming unzipper.
   * Supports expo-zip and react-native-zip-archive if available at runtime.
   * Returns collection path and extracted directory when successful.
   */
  private async tryStreamingUnzip(fileUri: string, options: ApkgParseOptions = {}): Promise<{ collectionPath: string; extractedDir: string } | null> {
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
        console.log('[ApkgParser] Using expo-zip for streaming unzip');
        options.onProgress?.('Unzipping with expo-zip…');
        await expoZip.unzipAsync(srcUri, extractedDir);
        const collectionPath = await this.resolveCollectionPath(extractedDir);
        if (!collectionPath) throw new Error('No collection file found after expo-zip unzip');
        return { collectionPath, extractedDir };
      }
    } catch (e) {
      console.warn('[ApkgParser] expo-zip unavailable or failed:', e);
    }

    // Try react-native-zip-archive next
    try {
      const rnza = this.safeRequire('react-native-zip-archive');
      if (rnza && typeof rnza.unzip === 'function') {
        console.log('[ApkgParser] Using react-native-zip-archive for streaming unzip');
        options.onProgress?.('Unzipping with rn-zip-archive…');
        const destFsPath = this.stripFileScheme(extractedDir);
        let unsubscribe: any = null;
        try {
          if (typeof rnza.subscribe === 'function') {
            unsubscribe = rnza.subscribe(({ progress }: any) => {
              if (typeof progress === 'number') {
                options.onProgress?.(`Unzipping… ${Math.round(progress)}%`);
              }
            });
          }
        } catch {}
        await rnza.unzip(srcFsPath, destFsPath);
        try { if (unsubscribe) unsubscribe(); } catch {}
        const collectionPath = await this.resolveCollectionPath(extractedDir);
        if (!collectionPath) throw new Error('No collection file found after rn-zip-archive unzip');
        return { collectionPath, extractedDir };
      }
    } catch (e) {
      console.warn('[ApkgParser] react-native-zip-archive unavailable or failed:', e);
    }

    // Cleanup created directory if nothing worked
    try { await FileSystem.deleteAsync(extractedDir, { idempotent: true }); } catch {}
    return null;
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
      console.log('[ApkgParser] Failed to require', moduleId, ':', e);
      return null;
    }
  }

  private async resolveCollectionPath(dir: string): Promise<string | null> {
    const p1 = `${dir}collection.anki21`;
    const i1 = await FileSystem.getInfoAsync(p1);
    if (i1.exists && !i1.isDirectory) return p1;

    const p2 = `${dir}collection.anki2`;
    const i2 = await FileSystem.getInfoAsync(p2);
    if (i2.exists && !i2.isDirectory) return p2;
    return null;
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
   * Read large files by rejecting them with a helpful message
   * Unfortunately, React Native/JavaScript has fundamental limits for very large files
   */
  private async readLargeFileAsZip(fileUri: string, fileSizeMB: number): Promise<any> {
    console.log('[ApkgParser] Attempting to read large file with memory management...');

    // Try ArrayBuffer path first to avoid giant strings
    try {
      console.log('[ApkgParser] Reading large file using fetch API...');
      const res: any = await fetch(fileUri);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      // Prefer Response.arrayBuffer if available in this RN runtime
      let arrayBuffer: ArrayBuffer;
      if (typeof res.arrayBuffer === 'function') {
        console.log('[ApkgParser] Using Response.arrayBuffer()');
        arrayBuffer = await res.arrayBuffer();
      } else if (typeof res.blob === 'function') {
        const blob: any = await res.blob();
        if (blob && typeof blob.arrayBuffer === 'function') {
          console.log('[ApkgParser] Converting Blob to ArrayBuffer...');
          arrayBuffer = await blob.arrayBuffer();
        } else {
          throw new Error('Blob.arrayBuffer not supported in this environment');
        }
      } else {
        throw new Error('Response.arrayBuffer/Blob not supported in this environment');
      }
      console.log('[ApkgParser] Loading ZIP from ArrayBuffer...');
      const zip = await JSZip.loadAsync(arrayBuffer);
      console.log('[ApkgParser] Large file loaded successfully (ArrayBuffer path)');
      return zip;
    } catch (arrayBufferErr) {
      console.warn('[ApkgParser] ArrayBuffer path failed, trying base64 fallback...', arrayBufferErr);

      try {
        console.log('[ApkgParser] Reading as base64 fallback...');
        const base64 = await FileSystem.readAsStringAsync(fileUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        console.log('[ApkgParser] Base64 length:', (base64.length / (1024 * 1024)).toFixed(2), 'MB');
        console.log('[ApkgParser] Loading ZIP from base64...');
        const zip = await JSZip.loadAsync(base64, { base64: true });
        console.log('[ApkgParser] Large file loaded successfully (base64 fallback)');
        return zip;
      } catch (error) {
        console.error('[ApkgParser] Error reading large file:', error);

        if (error instanceof Error &&
            (error.message.includes('String length') ||
             error.message.includes('Maximum string length') ||
             error.message.includes('RangeError'))) {
          throw new Error(`File too large to process (${fileSizeMB.toFixed(1)}MB). The file exceeds JavaScript's string length limit.\n\nThis is a fundamental limitation of JavaScript on mobile devices.\n\nSolutions:\n• Split your deck into smaller files (<100MB each)\n• Use Anki desktop to create smaller exports\n• Remove large media files and import them separately\n• Import on a device with more available memory`);
        }

        throw new Error(`Failed to process large file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  /**
   * Clean up temp and media files
   */
  async cleanup(): Promise<void> {
    await FileSystem.deleteAsync(this.tempDir, { idempotent: true });
    await FileSystem.deleteAsync(this.mediaDir, { idempotent: true });
  }
}
