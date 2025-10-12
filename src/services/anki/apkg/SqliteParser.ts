/**
 * SQLite Parser
 * Extracts cards, notes, decks, and configs from Anki collection.anki2 database
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as SQLite from 'expo-sqlite';
import { AnkiCard, AnkiNote, AnkiCol, Deck, DeckConfig, AnkiRevlog } from '../schema';
import { ApkgParseResult } from './types';

export class SqliteParser {
  /**
   * Parse the collection.anki2 SQLite database
   */
  async parse(dbPath: string): Promise<ApkgParseResult> {
    console.log('[SqliteParser] Opening database at:', dbPath);

    // Check if file exists
    const fileInfo = await FileSystem.getInfoAsync(dbPath);
    console.log('[SqliteParser] File exists:', fileInfo.exists);

    // expo-sqlite might not support arbitrary paths, copy to SQLiteDatabase directory
    const sqliteDir = `${FileSystem.documentDirectory}SQLite/`;
    await FileSystem.makeDirectoryAsync(sqliteDir, { intermediates: true });
    const dbName = 'imported_collection.db';
    const dbInSqliteDir = `${sqliteDir}${dbName}`;

    console.log('[SqliteParser] Copying to SQLite directory:', dbInSqliteDir);
    await FileSystem.copyAsync({
      from: dbPath,
      to: dbInSqliteDir,
    });

    // Open database by name (relative to SQLite directory)
    const db = await SQLite.openDatabaseAsync(dbName);
    console.log('[SqliteParser] Database opened successfully');

    try {
      // Check what tables exist
      const tables = await db.getAllAsync<any>(
        "SELECT name FROM sqlite_master WHERE type='table'"
      );
      console.log('[SqliteParser] Tables in database:', tables);

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
      const decks = this.parseDecks(col.decks);

      // Parse deck configs
      const deckConfigs = this.parseDeckConfigs(col.dconf);

      // Read notes
      const notes = await this.parseNotes(db);

      // Read cards
      const cards = await this.parseCards(db);

      // Read revlog (review history)
      const revlog = await this.parseRevlog(db);

      return { col, cards, notes, decks, deckConfigs, mediaFiles: new Map(), revlog };
    } finally {
      await db.closeAsync();
    }
  }

  /**
   * Parse decks from JSON string
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
   * Parse deck configs from JSON string
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
    const notesRows = await db.getAllAsync<any>('SELECT * FROM notes');
    console.log('[SqliteParser] Found', notesRows.length, 'notes in database');
    notesRows.forEach((row, i) => {
      console.log(`[SqliteParser] Note ${i}:`, {
        id: row.id,
        mid: row.mid,
        flds: row.flds?.substring(0, 100), // First 100 chars
      });
    });

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
    const cardsRows = await db.getAllAsync<any>('SELECT * FROM cards');
    console.log('[SqliteParser] Found', cardsRows.length, 'cards in database');
    cardsRows.forEach((row, i) => {
      console.log(`[SqliteParser] Card ${i}:`, {
        id: row.id,
        nid: row.nid,
        did: row.did,
        ord: row.ord,
        type: row.type,
        queue: row.queue,
      });
    });

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
      const revlogRows = await db.getAllAsync<any>('SELECT * FROM revlog');
      console.log('[SqliteParser] Found', revlogRows.length, 'review history entries');
      return revlogRows.map((row) => ({
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
      console.log('[SqliteParser] No revlog table found or error reading it:', error);
      // Some .apkg files might not have revlog, that's okay
      return [];
    }
  }
}
