/**
 * PersistenceService Tests - Save/load database snapshots
 */

import { PersistenceService } from '../PersistenceService';
import { InMemoryDb } from '../InMemoryDb';
import * as FileSystem from 'expo-file-system/legacy';
import { createTestCard, createTestNote } from './helpers/factories';

describe('PersistenceService', () => {
  let db: InMemoryDb;

  beforeEach(() => {
    db = new InMemoryDb();
    jest.clearAllMocks();
  });

  describe('Save Database', () => {
    it('should save database to file', async () => {
      (FileSystem.writeAsStringAsync as jest.Mock).mockResolvedValue(undefined);

      await PersistenceService.save(db);

      expect(FileSystem.writeAsStringAsync).toHaveBeenCalled();
      const callArgs = (FileSystem.writeAsStringAsync as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toContain('anki-db.json');
      expect(typeof callArgs[1]).toBe('string');
    });

    it('should serialize database to JSON', async () => {
      (FileSystem.writeAsStringAsync as jest.Mock).mockResolvedValue(undefined);

      // Add some data to db
      const note = createTestNote({ id: 'note1' });
      const card = createTestCard({ id: 'card1', nid: 'note1' });
      db.addNote(note);
      db.addCard(card);

      await PersistenceService.save(db);

      const savedData = (FileSystem.writeAsStringAsync as jest.Mock).mock.calls[0][1];
      const parsed = JSON.parse(savedData);

      expect(parsed.notes).toBeDefined();
      expect(parsed.cards).toBeDefined();
      expect(parsed.notes.length).toBe(1);
      expect(parsed.cards.length).toBe(1);
    });

    it('should throw error if save fails', async () => {
      (FileSystem.writeAsStringAsync as jest.Mock).mockRejectedValue(
        new Error('Write failed')
      );

      await expect(PersistenceService.save(db)).rejects.toThrow('Write failed');
    });

    it('should handle large database', async () => {
      (FileSystem.writeAsStringAsync as jest.Mock).mockResolvedValue(undefined);

      // Add 100 cards
      for (let i = 0; i < 100; i++) {
        const note = createTestNote({ id: `note${i}` });
        const card = createTestCard({ id: `card${i}`, nid: `note${i}` });
        db.addNote(note);
        db.addCard(card);
      }

      await PersistenceService.save(db);

      // Verify save was called with data
      expect(FileSystem.writeAsStringAsync).toHaveBeenCalled();
      const savedData = (FileSystem.writeAsStringAsync as jest.Mock).mock.calls[0][1];
      const parsed = JSON.parse(savedData);
      expect(parsed.notes.length).toBe(100);
      expect(parsed.cards.length).toBe(100);
    });
  });

  describe('Load Database', () => {
    it('should load database from file', async () => {
      const mockData = {
        version: 1,
        timestamp: Date.now(),
        col: { id: '1', crt: 123456 },
        cards: [],
        notes: [],
        revlog: [],
        graves: [],
        decks: [],
        deckConfigs: [],
        models: [],
        media: [],
        colConfig: null,
        usn: -1,
      };

      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(mockData)
      );

      const loaded = await PersistenceService.load(db);

      expect(loaded).toBe(true);
      expect(FileSystem.readAsStringAsync).toHaveBeenCalled();
    });

    it('should return false if file does not exist', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: false });

      const loaded = await PersistenceService.load(db);

      expect(loaded).toBe(false);
      expect(FileSystem.readAsStringAsync).not.toHaveBeenCalled();
    });

    it('should restore cards and notes', async () => {
      const note = createTestNote({ id: 'note1' });
      const card = createTestCard({ id: 'card1', nid: 'note1' });

      const mockData = {
        version: 1,
        timestamp: Date.now(),
        col: db.getCol(),
        cards: [card],
        notes: [note],
        revlog: [],
        graves: [],
        decks: Array.from(db['decks'].values()),
        deckConfigs: Array.from(db['deckConfigs'].values()),
        models: Array.from(db['models'].values()),
        media: [],
        colConfig: db.getColConfig(),
        usn: -1,
      };

      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(mockData)
      );

      await PersistenceService.load(db);

      expect(db.getCard('card1')).toBeDefined();
      expect(db.getNote('note1')).toBeDefined();
    });

    it('should handle corrupted data gracefully', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(
        'invalid json {'
      );

      const loaded = await PersistenceService.load(db);

      expect(loaded).toBe(false);
    });

    it('should handle missing fields in data', async () => {
      const incompleteData = {
        version: 1,
        // Missing required fields
      };

      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(incompleteData)
      );

      const loaded = await PersistenceService.load(db);

      expect(loaded).toBe(false);
    });
  });

  describe('Check Existence', () => {
    it('should return true if database file exists', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });

      const exists = await PersistenceService.exists();

      expect(exists).toBe(true);
    });

    it('should return false if database file does not exist', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: false });

      const exists = await PersistenceService.exists();

      expect(exists).toBe(false);
    });
  });

  describe('Clear Database', () => {
    it('should delete database file', async () => {
      (FileSystem.deleteAsync as jest.Mock).mockResolvedValue(undefined);

      await PersistenceService.clear();

      expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
        expect.stringContaining('anki-db.json'),
        { idempotent: true }
      );
    });

    it('should not throw if file does not exist', async () => {
      (FileSystem.deleteAsync as jest.Mock).mockResolvedValue(undefined);

      await expect(PersistenceService.clear()).resolves.not.toThrow();
    });

    it('should handle deletion errors gracefully', async () => {
      (FileSystem.deleteAsync as jest.Mock).mockRejectedValue(
        new Error('Delete failed')
      );

      // Should not throw, just log error
      await expect(PersistenceService.clear()).resolves.not.toThrow();
    });
  });

  describe('Round-trip Persistence', () => {
    it('should save and load database correctly', async () => {
      // Add data
      const note = createTestNote({ id: 'note1', flds: 'Front\x1fBack' });
      const card = createTestCard({ id: 'card1', nid: 'note1' });
      db.addNote(note);
      db.addCard(card);

      let savedData: string = '';
      (FileSystem.writeAsStringAsync as jest.Mock).mockImplementation(
        (path, data) => {
          savedData = data;
          return Promise.resolve();
        }
      );

      // Save
      await PersistenceService.save(db);

      // Create new db and load
      const newDb = new InMemoryDb();
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(savedData);

      await PersistenceService.load(newDb);

      // Verify data matches
      expect(newDb.getCard('card1')).toBeDefined();
      expect(newDb.getNote('note1')).toBeDefined();
      expect(newDb.getNote('note1')?.flds).toBe('Front\x1fBack');
    });

    it('should preserve all data types', async () => {
      // Add various data
      db.addMedia({
        id: 'media1',
        filename: 'test.jpg',
        hash: 'hash123',
        mime: 'image/jpeg',
        size: 1024,
        localUri: 'file://test.jpg',
        created: 123456,
      });

      db.addRevlog({
        id: '1',
        cid: 'card1',
        usn: -1,
        ease: 3,
        ivl: 7,
        lastIvl: 5,
        factor: 2500,
        time: 5000,
        type: 1,
      });

      let savedData: string = '';
      (FileSystem.writeAsStringAsync as jest.Mock).mockImplementation(
        (path, data) => {
          savedData = data;
          return Promise.resolve();
        }
      );

      await PersistenceService.save(db);

      const newDb = new InMemoryDb();
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(savedData);

      await PersistenceService.load(newDb);

      expect(newDb.getAllMedia().length).toBe(1);
      expect(newDb.getAllRevlog().length).toBe(1);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle multiple save operations', async () => {
      (FileSystem.writeAsStringAsync as jest.Mock).mockResolvedValue(undefined);

      // Trigger multiple saves
      await Promise.all([
        PersistenceService.save(db),
        PersistenceService.save(db),
        PersistenceService.save(db),
      ]);

      expect(FileSystem.writeAsStringAsync).toHaveBeenCalledTimes(3);
    });
  });

  describe('Error Recovery', () => {
    it('should maintain db integrity if save fails', async () => {
      const note = createTestNote({ id: 'note1' });
      db.addNote(note);

      (FileSystem.writeAsStringAsync as jest.Mock).mockRejectedValue(
        new Error('Disk full')
      );

      try {
        await PersistenceService.save(db);
      } catch (error) {
        // Should still be able to access db
        expect(db.getNote('note1')).toBeDefined();
      }
    });

    it('should maintain db state if load fails', async () => {
      const note = createTestNote({ id: 'original' });
      db.addNote(note);

      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
      (FileSystem.readAsStringAsync as jest.Mock).mockRejectedValue(
        new Error('Read failed')
      );

      await PersistenceService.load(db);

      // Original data should still be intact
      expect(db.getNote('original')).toBeDefined();
    });
  });

  describe('File Path', () => {
    it('should return correct database path', () => {
      const path = PersistenceService.getDbPath();
      
      expect(path).toContain('anki-db.json');
      expect(path).toBeTruthy();
    });
  });
});
