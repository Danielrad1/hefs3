/**
 * .apkg Parser
 * Extracts and parses Anki .apkg files
 */

import * as FileSystem from 'expo-file-system/legacy';
import JSZip from 'jszip';
import * as SQLite from 'expo-sqlite';
import { AnkiCard, AnkiNote, AnkiCol, Deck, DeckConfig } from './schema';

export interface ApkgParseResult {
  col: AnkiCol;
  cards: AnkiCard[];
  notes: AnkiNote[];
  decks: Map<string, Deck>;
  deckConfigs: Map<string, DeckConfig>;
  mediaFiles: Map<string, string>; // mediaId -> filename
}

export class ApkgParser {
  private tempDir = `${FileSystem.documentDirectory}temp/`;
  private mediaDir = `${FileSystem.documentDirectory}media/`;

  /**
   * Parse an .apkg file from a URI
   */
  async parse(fileUri: string): Promise<ApkgParseResult> {
    console.log('[ApkgParser] Starting parse:', fileUri);

    // Ensure directories exist
    await this.ensureDirectories();

    // Read file as base64
    console.log('[ApkgParser] Reading file...');
    const base64 = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Unzip
    console.log('[ApkgParser] Unzipping...');
    const zip = await JSZip.loadAsync(base64, { base64: true });

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

    // Extract as base64 directly (better for binary files)
    const collectionBase64 = await collectionFile.async('base64');
    console.log('[ApkgParser] Extracted base64 length:', collectionBase64.length);
    
    const collectionPath = `${this.tempDir}collection.anki2`;
    console.log('[ApkgParser] Writing to:', collectionPath);
    
    // Write SQLite file as base64
    await FileSystem.writeAsStringAsync(
      collectionPath,
      collectionBase64,
      { encoding: FileSystem.EncodingType.Base64 }
    );
    console.log('[ApkgParser] Write complete');
    
    // Verify file was written
    const writtenInfo = await FileSystem.getInfoAsync(collectionPath);
    console.log('[ApkgParser] File written, exists:', writtenInfo.exists);
    
    // Try reading first few bytes to verify it's a valid SQLite file
    // SQLite files start with "SQLite format 3\0" (hex: 53 51 4c 69 74 65 20 66 6f 72 6d 61 74 20 33 00)
    const testRead = await FileSystem.readAsStringAsync(collectionPath, {
      encoding: FileSystem.EncodingType.Base64,
    });
    console.log('[ApkgParser] First 50 chars of base64:', testRead.substring(0, 50));
    
    // Decode first 16 bytes to check SQLite header
    const headerBase64 = testRead.substring(0, 24); // ~16 bytes in base64
    const headerBinary = atob(headerBase64);
    console.log('[ApkgParser] First 16 bytes as string:', headerBinary);
    console.log('[ApkgParser] Expected: "SQLite format 3"');

    // Parse SQLite
    console.log('[ApkgParser] Parsing SQLite database...');
    const result = await this.parseSQLite(collectionPath);

    // Extract media
    console.log('[ApkgParser] Extracting media files...');
    const mediaMap = await this.extractMedia(zip);
    result.mediaFiles = mediaMap;

    console.log('[ApkgParser] Parse complete!');
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

      return { col, cards, notes, decks, deckConfigs, mediaFiles: new Map() };
    } finally {
      await db.closeAsync();
    }
  }

  /**
   * Extract media files from the .apkg
   */
  private async extractMedia(zip: JSZip): Promise<Map<string, string>> {
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
    for (const [id, filename] of Object.entries(mediaMapping)) {
      const file = zip.file(id);
      if (file) {
        const blob = await file.async('uint8array');
        const destPath = `${this.mediaDir}${filename}`;
        
        console.log(`[ApkgParser] Writing media file: ${filename} to ${destPath}`);
        await FileSystem.writeAsStringAsync(
          destPath,
          this.uint8ArrayToBase64(blob),
          { encoding: FileSystem.EncodingType.Base64 }
        );

        // Verify file was written
        const fileInfo = await FileSystem.getInfoAsync(destPath);
        const size = fileInfo.exists && !fileInfo.isDirectory ? (fileInfo as any).size : 0;
        console.log(`[ApkgParser] Media file written: ${filename}, exists: ${fileInfo.exists}, size: ${size}`);

        mediaMap.set(id, filename);
      } else {
        console.warn(`[ApkgParser] Media file ${id} (${filename}) not found in zip`);
      }
    }

    console.log(`[ApkgParser] Extracted ${mediaMap.size} media files to ${this.mediaDir}`);
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
   * Convert Uint8Array to base64 string
   */
  private uint8ArrayToBase64(uint8Array: Uint8Array): string {
    let binary = '';
    const len = uint8Array.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    return btoa(binary);
  }

  /**
   * Clean up temp and media files
   */
  async cleanup(): Promise<void> {
    await FileSystem.deleteAsync(this.tempDir, { idempotent: true });
    await FileSystem.deleteAsync(this.mediaDir, { idempotent: true });
  }
}
