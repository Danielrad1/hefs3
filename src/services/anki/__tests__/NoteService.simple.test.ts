/**
 * NoteService Tests - Simplified for existing API
 */

import { NoteService } from '../NoteService';
import { InMemoryDb } from '../InMemoryDb';
import { MODEL_TYPE_STANDARD, MODEL_TYPE_CLOZE } from '../schema';

describe('NoteService', () => {
  let db: InMemoryDb;
  let noteService: NoteService;

  beforeEach(() => {
    db = new InMemoryDb();
    noteService = new NoteService(db);
  });

  describe('Create Note', () => {
    it('should create a basic note with 1 card', () => {
      const note = noteService.createNote({
        modelId: 1,
        deckId: '1',
        fields: ['Front text', 'Back text'],
      });

      expect(note.id).toBeDefined();
      expect(note.flds).toBe('Front text\x1fBack text');
      
      // Verify note is in database
      const savedNote = db.getNote(note.id);
      expect(savedNote).toBeDefined();
      
      // Should create 1 card for basic model
      const cards = db.getAllCards().filter(c => c.nid === note.id);
      expect(cards.length).toBe(1);
      expect(cards[0].did).toBe('1');
    });

    it('should create cloze note with multiple cards', () => {
      const note = noteService.createNote({
        modelId: 2, // Cloze model
        deckId: '1',
        fields: ['{{c1::cloze1}} and {{c2::cloze2}}', ''],
      });

      expect(note.mid).toBe(2);
      
      // Should create 2 cards for 2 cloze deletions
      const cards = db.getAllCards().filter(c => c.nid === note.id);
      expect(cards.length).toBe(2);
      expect(cards[0].ord).toBe(0);
      expect(cards[1].ord).toBe(1);
    });

    it('should handle tags correctly', () => {
      const note = noteService.createNote({
        modelId: 1,
        deckId: '1',
        fields: ['Front', 'Back'],
        tags: ['important', 'review'],
      });

      expect(note.tags).toBe(' important review '); // Surrounding spaces!
    });

    it('should throw error for invalid model', () => {
      expect(() => {
        noteService.createNote({
          modelId: 999,
          deckId: '1',
          fields: ['Front', 'Back'],
        });
      }).toThrow('Model 999 not found');
    });

    it('should throw error for invalid deck', () => {
      expect(() => {
        noteService.createNote({
          modelId: 1,
          deckId: 'nonexistent',
          fields: ['Front', 'Back'],
        });
      }).toThrow('Deck nonexistent not found');
    });

    it('should throw error for wrong field count', () => {
      expect(() => {
        noteService.createNote({
          modelId: 1,
          deckId: '1',
          fields: ['Only one field'], // Should be 2 for Basic model
        });
      }).toThrow('Expected 2 fields, got 1');
    });
  });

  describe('Delete Note', () => {
    it('should delete note and its cards', async () => {
      // Create note
      const note = noteService.createNote({
        modelId: 1,
        deckId: '1',
        fields: ['Front', 'Back'],
      });

      const cardsBefore = db.getAllCards().filter(c => c.nid === note.id);
      expect(cardsBefore.length).toBe(1);

      // Delete note
      await noteService.deleteNote(note.id);

      // Verify deletion
      expect(db.getNote(note.id)).toBeUndefined();
      const cardsAfter = db.getAllCards().filter(c => c.nid === note.id);
      expect(cardsAfter.length).toBe(0);
    });

    it('should throw error when deleting nonexistent note', async () => {
      await expect(
        noteService.deleteNote('nonexistent')
      ).rejects.toThrow('Note nonexistent not found');
    });

    it('should delete all cards from cloze note', async () => {
      // Create cloze note with 2 cards
      const note = noteService.createNote({
        modelId: 2,
        deckId: '1',
        fields: ['{{c1::one}} {{c2::two}}', ''],
      });

      expect(db.getAllCards().filter(c => c.nid === note.id).length).toBe(2);

      // Delete note
      await noteService.deleteNote(note.id);

      // All cards should be deleted
      expect(db.getAllCards().filter(c => c.nid === note.id).length).toBe(0);
    });
  });

  describe('Update Note', () => {
    it('should update note fields', async () => {
      const note = noteService.createNote({
        modelId: 1,
        deckId: '1',
        fields: ['Original Front', 'Original Back'],
      });

      await noteService.updateNote(note.id, {
        fields: ['Updated Front', 'Updated Back'],
      });

      const updated = db.getNote(note.id);
      expect(updated?.flds).toBe('Updated Front\x1fUpdated Back');
    });

    it('should throw error for nonexistent note', () => {
      expect(() =>
        noteService.updateNote('nonexistent', {
          fields: ['Front', 'Back'],
        })
      ).toThrow('Note nonexistent not found');
    });
  });

  describe('Cards Generation', () => {
    it('should increment nextPos for each card created', () => {
      const colConfig = db.getColConfig();
      const initialPos = colConfig.nextPos;

      // Create 2 notes (2 cards total)
      noteService.createNote({
        modelId: 1,
        deckId: '1',
        fields: ['Front 1', 'Back 1'],
      });

      noteService.createNote({
        modelId: 1,
        deckId: '1',
        fields: ['Front 2', 'Back 2'],
      });

      const newConfig = db.getColConfig();
      expect(newConfig.nextPos).toBe(initialPos + 2);
    });

    it('should assign correct ordinals to cloze cards', () => {
      const note = noteService.createNote({
        modelId: 2,
        deckId: '1',
        fields: ['{{c1::a}} {{c2::b}} {{c3::c}}', ''],
      });

      const cards = db.getAllCards().filter(c => c.nid === note.id);
      cards.sort((a, b) => a.ord - b.ord);

      expect(cards.length).toBe(3);
      expect(cards[0].ord).toBe(0);
      expect(cards[1].ord).toBe(1);
      expect(cards[2].ord).toBe(2);
    });
  });
});
