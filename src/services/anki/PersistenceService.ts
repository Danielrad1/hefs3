/**
 * PersistenceService - Save and load database snapshots
 */

import * as FileSystem from 'expo-file-system/legacy';
import { InMemoryDb } from './InMemoryDb';

const DB_FILE = `${FileSystem.documentDirectory}anki-db.json`;

export class PersistenceService {
  /**
   * Save database to file
   */
  static async save(db: InMemoryDb): Promise<void> {
    try {
      const json = db.toJSON();
      await FileSystem.writeAsStringAsync(DB_FILE, json);
      console.log('[PersistenceService] Database saved successfully');
    } catch (error) {
      console.error('[PersistenceService] Error saving database:', error);
      throw error;
    }
  }

  /**
   * Load database from file
   */
  static async load(db: InMemoryDb): Promise<boolean> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(DB_FILE);
      
      if (!fileInfo.exists) {
        console.log('[PersistenceService] No saved database found');
        return false;
      }

      const json = await FileSystem.readAsStringAsync(DB_FILE);
      db.fromJSON(json);
      console.log('[PersistenceService] Database loaded successfully');
      return true;
    } catch (error) {
      console.error('[PersistenceService] Error loading database:', error);
      return false;
    }
  }

  /**
   * Check if saved database exists
   */
  static async exists(): Promise<boolean> {
    const fileInfo = await FileSystem.getInfoAsync(DB_FILE);
    return fileInfo.exists;
  }

  /**
   * Delete saved database
   */
  static async clear(): Promise<void> {
    try {
      await FileSystem.deleteAsync(DB_FILE, { idempotent: true });
      console.log('[PersistenceService] Database file deleted');
    } catch (error) {
      console.error('[PersistenceService] Error deleting database:', error);
    }
  }
}
