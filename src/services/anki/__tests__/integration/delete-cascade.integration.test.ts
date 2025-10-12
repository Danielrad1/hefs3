/**
 * Delete Cascade Integration Test
 * Tests the full flow: Delete Card → Delete Note → Cleanup Media
 */

import { InMemoryDb } from '../../InMemoryDb';
import { CardService } from '../../CardService';
import { NoteService } from '../../NoteService';
import { MediaService } from '../../MediaService';
import { createTestCard, createTestNote, createTestMedia } from '../helpers/factories';
import * as FileSystem from 'expo-file-system/legacy';

describe('Delete Cascade Integration', () => {
  let db: InMemoryDb;
  let cardService: CardService;
  let noteService: NoteService;
  let mediaService: MediaService;

  beforeEach(() => {
    db = new InMemoryDb();
    cardService = new CardService(db);
    noteService = new NoteService(db);
    mediaService = new MediaService(db);
    
    // Reset mocks
    jest.clearAllMocks();
  });

  describe('Single Card Deletion', () => {
    it('should delete card → note → orphaned media', async () => {
      // Step 1: Create note with media
      const note = createTestNote({
        id: 'note1',
        flds: '<img src="unique.jpg">\x1fBack',
      });
      db.addNote(note);

      // Step 2: Create card
      const card = createTestCard({
        id: 'card1',
        nid: 'note1',
      });
      db.addCard(card);

      // Step 3: Add media
      const media = createTestMedia('unique.jpg');
      db.addMedia(media);

      // Verify setup
      expect(db.getCard('card1')).toBeDefined();
      expect(db.getNote('note1')).toBeDefined();
      expect(db.getAllMedia().length).toBe(1);

      // Step 4: Delete card (should cascade to note and media)
      await cardService.deleteCards(['card1']);

      // Verify cascade
      expect(db.getCard('card1')).toBeUndefined();
      expect(db.getNote('note1')).toBeUndefined(); // Note orphaned, deleted
      expect(db.getAllMedia().length).toBe(0); // Media orphaned, GC'd
      expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
        media.localUri,
        { idempotent: true }
      );
    });

    it('should preserve note when deleting one card of many', async () => {
      // Cloze note with 2 cards
      const note = createTestNote({
        id: 'note1',
        mid: 2, // Cloze model
        flds: '{{c1::one}} {{c2::two}}\x1fExtra',
      });
      db.addNote(note);

      const card1 = createTestCard({
        id: 'card1',
        nid: 'note1',
        ord: 0,
      });
      const card2 = createTestCard({
        id: 'card2',
        nid: 'note1',
        ord: 1,
      });
      db.addCard(card1);
      db.addCard(card2);

      // Delete only first card
      await cardService.deleteCards(['card1']);

      // Note and second card should remain
      expect(db.getNote('note1')).toBeDefined();
      expect(db.getCard('card1')).toBeUndefined();
      expect(db.getCard('card2')).toBeDefined();
    });
  });

  describe('Note Deletion', () => {
    it('should delete note → all cards → orphaned media', async () => {
      // Note with image
      const note = createTestNote({
        id: 'note1',
        flds: '<img src="image.jpg">\x1fBack',
      });
      db.addNote(note);

      // Card for the note
      const card = createTestCard({
        id: 'card1',
        nid: 'note1',
      });
      db.addCard(card);

      // Media
      const media = createTestMedia('image.jpg');
      db.addMedia(media);

      // Delete note directly
      await noteService.deleteNote('note1');

      // Everything should be deleted
      expect(db.getNote('note1')).toBeUndefined();
      expect(db.getCard('card1')).toBeUndefined();
      expect(db.getAllMedia().length).toBe(0);
    });

    it('should preserve shared media', async () => {
      // Two notes sharing same image
      const note1 = createTestNote({
        id: 'note1',
        flds: '<img src="shared.jpg">\x1fBack 1',
      });
      const note2 = createTestNote({
        id: 'note2',
        flds: '<img src="shared.jpg">\x1fBack 2',
      });
      db.addNote(note1);
      db.addNote(note2);

      const card1 = createTestCard({ id: 'card1', nid: 'note1' });
      const card2 = createTestCard({ id: 'card2', nid: 'note2' });
      db.addCard(card1);
      db.addCard(card2);

      const media = createTestMedia('shared.jpg');
      db.addMedia(media);

      // Delete first note
      await noteService.deleteNote('note1');

      // Second note and shared media should remain
      expect(db.getNote('note2')).toBeDefined();
      expect(db.getAllMedia().length).toBe(1);
      expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
    });
  });

  describe('Media Deduplication During Deletion', () => {
    it('should handle duplicate media hashes correctly', async () => {
      // Two different filenames, same hash (duplicates)
      const media1 = createTestMedia('image1.jpg', {
        id: 'media1',
        hash: 'same-hash-123',
      });
      const media2 = createTestMedia('image2.jpg', {
        id: 'media2',
        hash: 'same-hash-123', // Same hash!
      });
      db.addMedia(media1);
      db.addMedia(media2);

      // Note references first filename
      const note = createTestNote({
        id: 'note1',
        flds: '<img src="image1.jpg">\x1fBack',
      });
      db.addNote(note);

      const card = createTestCard({ id: 'card1', nid: 'note1' });
      db.addCard(card);

      // Delete the note
      await noteService.deleteNote('note1');

      // Both media files should be deleted (both orphaned)
      expect(db.getAllMedia().length).toBe(0);
    });
  });

  describe('Complex Deletion Scenarios', () => {
    it('should handle mixed media types (images + audio)', async () => {
      const note = createTestNote({
        id: 'note1',
        flds: '<img src="image.jpg"> [sound:audio.mp3]\x1fBack',
      });
      db.addNote(note);

      const card = createTestCard({ id: 'card1', nid: 'note1' });
      db.addCard(card);

      const imageMedia = createTestMedia('image.jpg', {
        id: 'media1',
        mime: 'image/jpeg',
      });
      const audioMedia = createTestMedia('audio.mp3', {
        id: 'media2',
        mime: 'audio/mpeg',
      });
      db.addMedia(imageMedia);
      db.addMedia(audioMedia);

      // Delete note
      await noteService.deleteNote('note1');

      // Both media should be deleted
      expect(db.getAllMedia().length).toBe(0);
      expect(FileSystem.deleteAsync).toHaveBeenCalledTimes(2);
    });

    it('should handle media referenced in multiple fields', async () => {
      const note = createTestNote({
        id: 'note1',
        flds: '<img src="image.jpg">\x1f<img src="image.jpg">\x1f<img src="image.jpg">',
      });
      db.addNote(note);

      const card = createTestCard({ id: 'card1', nid: 'note1' });
      db.addCard(card);

      const media = createTestMedia('image.jpg');
      db.addMedia(media);

      // Delete note
      await noteService.deleteNote('note1');

      // Media should only be deleted once
      expect(db.getAllMedia().length).toBe(0);
      expect(FileSystem.deleteAsync).toHaveBeenCalledTimes(1);
    });

    it('should preserve media when any note still references it', async () => {
      // Three notes, two reference same media
      const note1 = createTestNote({
        id: 'note1',
        flds: '<img src="shared.jpg">\x1fBack 1',
      });
      const note2 = createTestNote({
        id: 'note2',
        flds: '<img src="shared.jpg">\x1fBack 2',
      });
      const note3 = createTestNote({
        id: 'note3',
        flds: 'No media\x1fBack 3',
      });
      db.addNote(note1);
      db.addNote(note2);
      db.addNote(note3);

      const card1 = createTestCard({ id: 'card1', nid: 'note1' });
      const card2 = createTestCard({ id: 'card2', nid: 'note2' });
      const card3 = createTestCard({ id: 'card3', nid: 'note3' });
      db.addCard(card1);
      db.addCard(card2);
      db.addCard(card3);

      const media = createTestMedia('shared.jpg');
      db.addMedia(media);

      // Delete note1 and note3
      await noteService.deleteNote('note1');
      await noteService.deleteNote('note3');

      // Media should still exist (note2 references it)
      expect(db.getAllMedia().length).toBe(1);
      expect(db.getNote('note2')).toBeDefined();
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle deleting note with no media efficiently', async () => {
      const note = createTestNote({
        id: 'note1',
        flds: 'Just text\x1fNo media here',
      });
      db.addNote(note);

      const card = createTestCard({ id: 'card1', nid: 'note1' });
      db.addCard(card);

      await noteService.deleteNote('note1');

      // Should not attempt to delete any media
      expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
    });

    it('should handle deleting multiple cards in batch', async () => {
      // Create 3 notes with 3 cards
      const notes = [1, 2, 3].map(i =>
        createTestNote({ id: `note${i}`, flds: `Front ${i}\x1fBack ${i}` })
      );
      notes.forEach(n => db.addNote(n));

      const cards = [1, 2, 3].map(i =>
        createTestCard({ id: `card${i}`, nid: `note${i}` })
      );
      cards.forEach(c => db.addCard(c));

      // Delete all cards at once
      await cardService.deleteCards(['card1', 'card2', 'card3']);

      // All notes and cards should be deleted
      expect(db.getAllNotes().length).toBe(0);
      expect(db.getAllCards().length).toBe(0);
    });

    it('should handle media with special characters in filename', async () => {
      const note = createTestNote({
        id: 'note1',
        flds: '<img src="image (1).jpg">\x1fBack',
      });
      db.addNote(note);

      const card = createTestCard({ id: 'card1', nid: 'note1' });
      db.addCard(card);

      const media = createTestMedia('image (1).jpg');
      db.addMedia(media);

      await noteService.deleteNote('note1');

      expect(db.getAllMedia().length).toBe(0);
    });
  });

  describe('Graves (Sync Tracking)', () => {
    it('should record deleted cards in graves table', async () => {
      const note = createTestNote({ id: 'note1' });
      db.addNote(note);

      const card = createTestCard({ id: 'card1', nid: 'note1' });
      db.addCard(card);

      const gravesBefore = db['graves']; // Access private field for testing
      const gravesCountBefore = gravesBefore.length;

      await cardService.deleteCards(['card1']);

      const gravesAfter = db['graves'];
      expect(gravesAfter.length).toBeGreaterThan(gravesCountBefore);
      
      // Should record both card and note deletion
      const recentGraves = gravesAfter.slice(-2);
      expect(recentGraves.some(g => g.oid === 'card1')).toBe(true);
      expect(recentGraves.some(g => g.oid === 'note1')).toBe(true);
    });
  });
});
