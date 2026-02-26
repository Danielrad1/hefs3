/**
 * SQLite Parser
 * Extracts cards, notes, decks, and configs from Anki collection.anki2 database
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as SQLite from 'expo-sqlite';
import { AnkiCard, AnkiNote, AnkiCol, Deck, DeckConfig, AnkiRevlog } from '../schema';
import { ApkgParseResult } from './types';
import { logger } from '../../../utils/logger';

export class SqliteParser {
  /**
   * Parse the collection.anki2 SQLite database
   * Supports both legacy schema (v11) and newer schema (v18+)
   */
  async parse(dbPath: string): Promise<ApkgParseResult> {
    logger.info('[SqliteParser] ========== PARSING SQLITE DATABASE ==========');
    logger.info('[SqliteParser] Database path:', dbPath);

    // Check if file exists
    const fileInfo = await FileSystem.getInfoAsync(dbPath);
    logger.info('[SqliteParser] File exists:', fileInfo.exists);
    if (fileInfo.exists && !fileInfo.isDirectory) {
      const size = (fileInfo as any).size || 0;
      logger.info('[SqliteParser] File size:', size, 'bytes', `(${(size / 1024 / 1024).toFixed(2)} MB)`);
    }

    // expo-sqlite might not support arbitrary paths, copy to SQLiteDatabase directory
    const sqliteDir = `${FileSystem.documentDirectory}SQLite/`;
    await FileSystem.makeDirectoryAsync(sqliteDir, { intermediates: true });
    const dbName = 'imported_collection.db';
    const dbInSqliteDir = `${sqliteDir}${dbName}`;

    logger.info('[SqliteParser] Copying to SQLite directory:', dbInSqliteDir);
    logger.info('[SqliteParser] Source path:', dbPath);
    
    // Verify source file exists before copying
    const sourceInfo = await FileSystem.getInfoAsync(dbPath);
    logger.info('[SqliteParser] Source file exists:', sourceInfo.exists);
    if (sourceInfo.exists && !sourceInfo.isDirectory) {
      const sourceSize = (sourceInfo as any).size || 0;
      logger.info('[SqliteParser] Source file size:', sourceSize, 'bytes');
    }
    
    if (!sourceInfo.exists) {
      logger.error('[SqliteParser] ✗ Source file does not exist!');
      throw new Error(`Source database file not found at: ${dbPath}`);
    }
    
    try {
      await FileSystem.copyAsync({
        from: dbPath,
        to: dbInSqliteDir,
      });
      logger.info('[SqliteParser] ✓ Copy successful');
      
      // Verify destination file
      const destInfo = await FileSystem.getInfoAsync(dbInSqliteDir);
      logger.info('[SqliteParser] Destination file exists:', destInfo.exists);
      if (destInfo.exists && !destInfo.isDirectory) {
        const destSize = (destInfo as any).size || 0;
        logger.info('[SqliteParser] Destination file size:', destSize, 'bytes');
      }
    } catch (e) {
      logger.error('[SqliteParser] ✗ Copy failed:', e);
      logger.error('[SqliteParser] Error details:', e instanceof Error ? e.message : String(e));
      throw e;
    }

    // Open database by name (relative to SQLite directory)
    logger.info('[SqliteParser] Opening database:', dbName);
    const db = await SQLite.openDatabaseAsync(dbName);
    logger.info('[SqliteParser] ✓ Database opened successfully');

    try {
      // Check what tables exist
      logger.info('[SqliteParser] Querying database schema...');
      const tables = await db.getAllAsync<any>(
        "SELECT name FROM sqlite_master WHERE type='table'"
      );
      const tableNames = tables.map((t: any) => t.name);
      logger.info('[SqliteParser] Found', tableNames.length, 'tables:', tableNames);

      // Detect schema version by checking if 'col' table exists
      const hasColTable = tableNames.includes('col');
      
      if (hasColTable) {
        logger.info('[SqliteParser] ========== LEGACY SCHEMA DETECTED (v11) ==========');
        logger.info('[SqliteParser] Using legacy parser with col table');
        return await this.parseLegacySchema(db);
      } else {
        logger.info('[SqliteParser] ========== NEWER SCHEMA DETECTED (v18+) ==========');
        logger.info('[SqliteParser] Using newer parser with separate tables');
        return await this.parseNewSchema(db);
      }
    } catch (e) {
      logger.error('[SqliteParser] ========== PARSING FAILED ==========');
      logger.error('[SqliteParser] Error type:', e instanceof Error ? e.constructor.name : typeof e);
      logger.error('[SqliteParser] Error message:', e instanceof Error ? e.message : String(e));
      logger.error('[SqliteParser] Error stack:', e instanceof Error ? e.stack : 'N/A');
      throw e;
    } finally {
      await db.closeAsync();
      logger.info('[SqliteParser] Database closed');
    }
  }

  /**
   * Parse legacy schema (v11) - has col table with JSON fields
   */
  private async parseLegacySchema(db: any): Promise<ApkgParseResult> {
    logger.info('[SqliteParser] Reading col table...');
    const colRow = await db.getFirstAsync<any>('SELECT * FROM col');
    if (!colRow) {
      logger.error('[SqliteParser] ✗ No collection row found in col table');
      throw new Error('No collection row found in col table');
    }
    logger.info('[SqliteParser] ✓ Col row found, version:', colRow.ver);

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

    // Parse decks from JSON
    logger.info('[SqliteParser] Parsing decks from JSON...');
    logger.info('[SqliteParser] col.decks type:', typeof col.decks, 'length:', col.decks?.length);
    let decks: Map<string, Deck>;
    try {
      decks = this.parseDecks(col.decks);
      logger.info('[SqliteParser] ✓ Parsed', decks.size, 'decks');
    } catch (e) {
      logger.info('[SqliteParser] Decks field is Protobuf (not JSON) - using v18+ table instead');
      decks = await this.parseDecksFromTable(db);
    }

    // Parse deck configs from JSON
    logger.info('[SqliteParser] Parsing deck configs from JSON...');
    logger.info('[SqliteParser] col.dconf type:', typeof col.dconf, 'length:', col.dconf?.length);
    let deckConfigs: Map<string, DeckConfig>;
    try {
      deckConfigs = this.parseDeckConfigs(col.dconf);
      logger.info('[SqliteParser] ✓ Parsed', deckConfigs.size, 'deck configs');
    } catch (e) {
      logger.info('[SqliteParser] Deck configs field is Protobuf (not JSON) - using v18+ table instead');
      deckConfigs = await this.parseDeckConfigsFromTable(db);
    }

    // Read notes
    const notes = await this.parseNotes(db);

    // Read cards
    const cards = await this.parseCards(db);

    // Read revlog (review history)
    const revlog = await this.parseRevlog(db);

    logger.info('[SqliteParser] ✓ Legacy schema parsing complete');
    return { col, cards, notes, decks, deckConfigs, mediaFiles: new Map(), revlog };
  }

  /**
   * Parse newer schema (v18+) - has separate notetypes, decks, config tables
   */
  private async parseNewSchema(db: any): Promise<ApkgParseResult> {
    logger.info('[SqliteParser] Building synthetic col object for v18+ schema...');

    // Build a synthetic col object for backward compatibility
    // In v18+, metadata is spread across multiple tables
    const col: AnkiCol = {
      id: Date.now().toString(),
      crt: Math.floor(Date.now() / 1000),
      mod: Date.now(),
      scm: Date.now(),
      ver: 18, // Newer schema version
      dty: 0,
      usn: -1,
      ls: 0,
      conf: '{}', // Will be populated from config table if exists
      models: '{}', // Will be populated from notetypes table
      decks: '{}', // Will be populated from decks table
      dconf: '{}', // Will be populated from deck_config table
      tags: '',
    };
    logger.info('[SqliteParser] ✓ Synthetic col object created');

    // Parse decks from decks table (v18+)
    logger.info('[SqliteParser] Parsing decks from decks table...');
    const decks = await this.parseDecksFromTable(db);
    logger.info('[SqliteParser] ✓ Parsed', decks.size, 'decks from table');
    
    // Convert decks Map to JSON string for col.decks
    const decksObj: any = {};
    decks.forEach((deck, id) => {
      decksObj[id] = deck;
    });
    col.decks = JSON.stringify(decksObj);

    // Parse deck configs from deck_config table (v18+)
    logger.info('[SqliteParser] Parsing deck configs from deck_config table...');
    const deckConfigs = await this.parseDeckConfigsFromTable(db);
    logger.info('[SqliteParser] ✓ Parsed', deckConfigs.size, 'deck configs from table');
    
    // Convert deckConfigs Map to JSON string for col.dconf
    const dconfObj: any = {};
    deckConfigs.forEach((conf, id) => {
      dconfObj[id] = conf;
    });
    col.dconf = JSON.stringify(dconfObj);

    // Parse models from notetypes table (v18+)
    logger.info('[SqliteParser] Parsing notetypes from notetypes table...');
    await this.parseNotetypesFromTable(db, col);
    const modelsCount = Object.keys(JSON.parse(col.models)).length;
    logger.info('[SqliteParser] ✓ Parsed', modelsCount, 'notetypes from table');

    // Read notes
    const notes = await this.parseNotes(db);

    // Read cards
    const cards = await this.parseCards(db);

    // Read revlog (review history)
    const revlog = await this.parseRevlog(db);

    logger.info('[SqliteParser] ✓ Newer schema parsing complete');
    return { col, cards, notes, decks, deckConfigs, mediaFiles: new Map(), revlog };
  }

  /**
   * Parse decks from decks table (v18+ schema)
   */
  private async parseDecksFromTable(db: any): Promise<Map<string, Deck>> {
    const decks = new Map<string, Deck>();
    
    try {
      const deckRows = await db.getAllAsync<any>('SELECT * FROM decks');
      logger.info('[SqliteParser] Found', deckRows.length, 'decks in decks table');
      
      for (let i = 0; i < deckRows.length; i++) {
        const row = deckRows[i];
        logger.info(`[SqliteParser] Processing deck ${i + 1}/${deckRows.length}, id:`, row.id, 'name:', row.name);
        
        // In v18+, config column contains Protobuf BLOB data (not JSON)
        // We skip parsing it and use the separate columns directly
        // The config column is logged for debugging but not parsed
        if (row.config) {
          const configType = typeof row.config;
          const configLength = row.config?.length || 0;
          logger.info('[SqliteParser] Deck has config field, type:', configType, 'length:', configLength);
          
          // Check if it looks like binary data (Protobuf BLOB)
          if (configType === 'object' && row.config instanceof Uint8Array) {
            logger.info('[SqliteParser] Config appears to be Protobuf BLOB - skipping parse, using column data');
          } else if (configType === 'string' && configLength > 0 && !row.config.trim().startsWith('{')) {
            logger.info('[SqliteParser] Config appears to be binary/Protobuf - skipping parse, using column data');
          }
        }
        
        // Use direct column values from v18+ schema
        decks.set(row.id.toString(), {
          id: row.id.toString(),
          name: row.name || 'Default',
          desc: '', // v18+ doesn't store description in easily accessible form
          conf: (row.config_id || '1').toString(), // v18+ has config_id column
          mod: row.mtime_secs || row.mod || Math.floor(Date.now() / 1000),
          usn: row.usn || -1,
          collapsed: false, // Default value, Protobuf would have this
          browserCollapsed: false, // Default value
        });
      }
      logger.info('[SqliteParser] ✓ Successfully parsed all decks');
    } catch (error) {
      logger.error('[SqliteParser] Error reading decks table:', error);
      logger.error('[SqliteParser] Error type:', error instanceof Error ? error.constructor.name : typeof error);
      logger.error('[SqliteParser] Error message:', error instanceof Error ? error.message : String(error));
      // Create a default deck if table doesn't exist
      decks.set('1', {
        id: '1',
        name: 'Default',
        desc: '',
        conf: '1',
        mod: Math.floor(Date.now() / 1000),
        usn: -1,
        collapsed: false,
        browserCollapsed: false,
      });
    }
    
    return decks;
  }

  /**
   * Parse deck configs from deck_config table (v18+ schema)
   */
  private async parseDeckConfigsFromTable(db: any): Promise<Map<string, DeckConfig>> {
    const deckConfigs = new Map<string, DeckConfig>();
    
    try {
      const configRows = await db.getAllAsync<any>('SELECT * FROM deck_config');
      logger.info('[SqliteParser] Found', configRows.length, 'deck configs in deck_config table');
      
      for (let i = 0; i < configRows.length; i++) {
        const row = configRows[i];
        logger.info(`[SqliteParser] Processing deck_config ${i + 1}/${configRows.length}, id:`, row.id, 'name:', row.name);
        
        // In v18+, config column contains Protobuf BLOB data (not JSON)
        // We use default config values since parsing Protobuf requires a library
        if (row.config) {
          const configType = typeof row.config;
          const configLength = row.config?.length || 0;
          logger.info('[SqliteParser] Config has config field, type:', configType, 'length:', configLength);
          logger.info('[SqliteParser] Config appears to be Protobuf BLOB - using default config values');
        }
        
        // Use default config with name from column
        const defaultConfig = this.getDefaultDeckConfig();
        deckConfigs.set(row.id.toString(), {
          id: row.id.toString(),
          name: row.name || 'Default',
          new: defaultConfig.new,
          rev: defaultConfig.rev,
          lapse: defaultConfig.lapse,
          dyn: false,
          usn: row.usn || -1,
          mod: row.mtime_secs || row.mod || Math.floor(Date.now() / 1000),
        });
      }
      logger.info('[SqliteParser] ✓ Successfully parsed all deck configs');
    } catch (error) {
      logger.error('[SqliteParser] Error reading deck_config table:', error);
      logger.error('[SqliteParser] Error type:', error instanceof Error ? error.constructor.name : typeof error);
      logger.error('[SqliteParser] Error message:', error instanceof Error ? error.message : String(error));
      // Create a default config if table doesn't exist
      const defaultConfig = this.getDefaultDeckConfig();
      deckConfigs.set('1', {
        id: '1',
        name: 'Default',
        ...defaultConfig,
        usn: -1,
        mod: Math.floor(Date.now() / 1000),
      });
    }
    
    return deckConfigs;
  }

  /**
   * Parse notetypes from notetypes table (v18+ schema)
   */
  private async parseNotetypesFromTable(db: any, col: AnkiCol): Promise<void> {
    try {
      const notetypeRows = await db.getAllAsync<any>('SELECT * FROM notetypes');
      logger.info('[SqliteParser] Found', notetypeRows.length, 'notetypes in notetypes table');
      
      const modelsObj: any = {};
      for (let i = 0; i < notetypeRows.length; i++) {
        const row = notetypeRows[i];
        logger.info(`[SqliteParser] Processing notetype ${i + 1}/${notetypeRows.length}, id:`, row.id, 'name:', row.name);
        
        // In v18+, config column contains Protobuf BLOB data (not JSON)
        // We need to read from separate tables (fields, templates) instead
        if (row.config) {
          const configType = typeof row.config;
          const configLength = row.config?.length || 0;
          logger.info('[SqliteParser] Notetype has config field, type:', configType, 'length:', configLength);
          logger.info('[SqliteParser] Config appears to be Protobuf BLOB - will read from fields/templates tables');
        }
        
        // Read fields and templates from their respective tables
        const fields = await this.parseFieldsForNotetype(db, row.id);
        const templates = await this.parseTemplatesForNotetype(db, row.id);
        
        // Build a basic model structure compatible with our app
        modelsObj[row.id.toString()] = {
          id: row.id,
          name: row.name || 'Basic',
          type: 0, // Standard note type (0=standard, 1=cloze)
          mod: row.mtime_secs || Math.floor(Date.now() / 1000),
          usn: row.usn || -1,
          sortf: 0,
          did: null,
          tmpls: templates,
          flds: fields,
          css: '',
          latexPre: '',
          latexPost: '',
          req: [],
          tags: [],
        };
      }
      
      logger.info('[SqliteParser] ✓ Successfully parsed all notetypes');
      col.models = JSON.stringify(modelsObj);
    } catch (error) {
      logger.error('[SqliteParser] Error reading notetypes table:', error);
      logger.error('[SqliteParser] Error type:', error instanceof Error ? error.constructor.name : typeof error);
      logger.error('[SqliteParser] Error message:', error instanceof Error ? error.message : String(error));
      col.models = '{}';
    }
  }

  /**
   * Parse fields for a notetype from fields table (v18+ schema)
   */
  private async parseFieldsForNotetype(db: any, notetypeId: number): Promise<any[]> {
    try {
      const fieldRows = await db.getAllAsync<any>(
        'SELECT * FROM fields WHERE ntid = ? ORDER BY ord',
        [notetypeId]
      );
      logger.info('[SqliteParser] Found', fieldRows.length, 'fields for notetype', notetypeId);
      
      return fieldRows.map((row: any) => ({
        name: row.name || `Field ${row.ord}`,
        ord: row.ord || 0,
        sticky: false,
        rtl: false,
        font: 'Arial',
        size: 20,
        description: '',
      }));
    } catch (error) {
      logger.warn('[SqliteParser] Error reading fields table for notetype', notetypeId, ':', error);
      // Return a default field if table doesn't exist or query fails
      return [{
        name: 'Front',
        ord: 0,
        sticky: false,
        rtl: false,
        font: 'Arial',
        size: 20,
        description: '',
      }, {
        name: 'Back',
        ord: 1,
        sticky: false,
        rtl: false,
        font: 'Arial',
        size: 20,
        description: '',
      }];
    }
  }

  /**
   * Parse templates for a notetype from templates table (v18+ schema)
   */
  private async parseTemplatesForNotetype(db: any, notetypeId: number): Promise<any[]> {
    try {
      const templateRows = await db.getAllAsync<any>(
        'SELECT * FROM templates WHERE ntid = ? ORDER BY ord',
        [notetypeId]
      );
      logger.info('[SqliteParser] Found', templateRows.length, 'templates for notetype', notetypeId);
      
      return templateRows.map((row: any) => ({
        name: row.name || `Card ${row.ord + 1}`,
        ord: row.ord || 0,
        qfmt: row.qfmt || '{{Front}}',
        afmt: row.afmt || '{{FrontSide}}\n\n<hr id=answer>\n\n{{Back}}',
        bqfmt: '',
        bafmt: '',
        did: null,
      }));
    } catch (error) {
      logger.warn('[SqliteParser] Error reading templates table for notetype', notetypeId, ':', error);
      // Return a default template if table doesn't exist or query fails
      return [{
        name: 'Card 1',
        ord: 0,
        qfmt: '{{Front}}',
        afmt: '{{FrontSide}}\n\n<hr id=answer>\n\n{{Back}}',
        bqfmt: '',
        bafmt: '',
        did: null,
      }];
    }
  }

  /**
   * Get default deck config
   */
  private getDefaultDeckConfig(): any {
    return {
      name: 'Default',
      new: {
        delays: [1, 10],
        ints: [1, 4, 0],
        initialFactor: 2500,
        perDay: 20,
        order: 1,
      },
      rev: {
        perDay: 200,
        ease4: 1.3,
        ivlFct: 1.0,
        maxIvl: 36500,
        fuzz: 0.05,
      },
      lapse: {
        delays: [10],
        mult: 0.0,
        minInt: 1,
        leechAction: 0,
        leechFails: 8,
      },
      dyn: false,
    };
  }

  /**
   * Parse decks from JSON string (legacy schema)
   */
  private parseDecks(decksJson: string): Map<string, Deck> {
    const parsed = JSON.parse(decksJson);
    const decks = new Map<string, Deck>();
    Object.entries(parsed).forEach(([id, deck]: [string, any]) => {
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
    return decks;
  }

  /**
   * Parse deck configs from JSON string (legacy schema)
   */
  private parseDeckConfigs(dconfJson: string): Map<string, DeckConfig> {
    const parsed = JSON.parse(dconfJson);
    const deckConfigs = new Map<string, DeckConfig>();
    Object.entries(parsed).forEach(([id, conf]: [string, any]) => {
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
    return deckConfigs;
  }

  /**
   * Parse notes from database
   */
  private async parseNotes(db: any): Promise<AnkiNote[]> {
    logger.info('[SqliteParser] Reading notes table...');
    const notesRows = await db.getAllAsync<any>('SELECT * FROM notes');
    logger.info('[SqliteParser] ✓ Found', notesRows.length, 'notes in database');
    if (notesRows.length > 0 && notesRows.length <= 5) {
      notesRows.forEach((row: any, i: number) => {
        logger.info(`[SqliteParser] Note ${i}:`, {
          id: row.id,
          mid: row.mid,
          flds: row.flds?.substring(0, 100),
        });
      });
    }

    return notesRows.map((row) => ({
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
  }

  /**
   * Parse cards from database
   */
  private async parseCards(db: any): Promise<AnkiCard[]> {
    logger.info('[SqliteParser] Reading cards table...');
    const cardsRows = await db.getAllAsync<any>('SELECT * FROM cards');
    logger.info('[SqliteParser] ✓ Found', cardsRows.length, 'cards in database');
    if (cardsRows.length > 0 && cardsRows.length <= 5) {
      cardsRows.forEach((row: any, i: number) => {
        logger.info(`[SqliteParser] Card ${i}:`, {
          id: row.id,
          nid: row.nid,
          did: row.did,
          ord: row.ord,
          type: row.type,
          queue: row.queue,
        });
      });
    }

    return cardsRows.map((row) => ({
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
  }

  /**
   * Parse review log (revlog) from database
   */
  private async parseRevlog(db: any): Promise<AnkiRevlog[]> {
    try {
      logger.info('[SqliteParser] Reading revlog table...');
      const revlogRows = await db.getAllAsync<any>('SELECT * FROM revlog');
      logger.info('[SqliteParser] ✓ Found', revlogRows.length, 'review history entries');
      return revlogRows.map((row: any) => ({
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
      logger.warn('[SqliteParser] No revlog table found or error reading it:', error);
      return [];
    }
  }
}
