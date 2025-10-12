/**
 * DeckService Tests - Deck operations and hierarchy
 */

import { DeckService } from '../DeckService';
import { InMemoryDb } from '../InMemoryDb';
import { MediaService } from '../MediaService';
import { CardType } from '../schema';
import { createTestCard, createTestNote, createTestDeck } from './helpers/factories';

describe('DeckService', () => {
  let db: InMemoryDb;
  let deckService: DeckService;
  let mediaService: MediaService;

  beforeEach(() => {
    db = new InMemoryDb();
    mediaService = new MediaService(db);
    deckService = new DeckService(db, mediaService);
  });

  describe('Create Deck', () => {
    it('should create a new deck', () => {
      const deck = deckService.createDeck('Spanish Vocabulary');
      
      expect(deck.id).toBeDefined();
      expect(deck.name).toBe('Spanish Vocabulary');
      
      const savedDeck = db.getDeck(deck.id);
      expect(savedDeck).toBeDefined();
      expect(savedDeck?.name).toBe('Spanish Vocabulary');
    });

    it('should create nested deck with :: separator', () => {
      const deck = deckService.createDeck('Languages::Spanish::Verbs');
      
      expect(deck.name).toBe('Languages::Spanish::Verbs');
      expect(db.getDeck(deck.id)).toBeDefined();
    });

    it('should assign unique IDs to decks', () => {
      const deck1 = deckService.createDeck('Deck 1');
      const deck2 = deckService.createDeck('Deck 2');
      
      expect(deck1.id).not.toBe(deck2.id);
    });

    it('should create deck with default config', () => {
      const deck = deckService.createDeck('Test Deck');
      
      expect(deck.conf).toBe('1'); // Default config ID
      const config = db.getDeckConfig(deck.conf);
      expect(config).toBeDefined();
    });
  });

  describe('Rename Deck', () => {
    it('should rename a deck', () => {
      const deck = deckService.createDeck('Old Name');
      
      deckService.renameDeck(deck.id, 'New Name');
      
      const updated = db.getDeck(deck.id);
      expect(updated?.name).toBe('New Name');
    });

    it('should throw error for nonexistent deck', () => {
      expect(() => {
        deckService.renameDeck('nonexistent', 'New Name');
      }).toThrow('Deck nonexistent not found');
    });

    it('should not allow renaming default deck', () => {
      expect(() => {
        deckService.renameDeck('1', 'Cannot Rename');
      }).toThrow('Cannot rename default deck');
    });
  });

  describe('Delete Deck', () => {
    it('should delete deck and its cards', async () => {
      const deck = deckService.createDeck('Temporary Deck');
      
      // Add cards to deck
      const note = createTestNote({ id: 'note1' });
      db.addNote(note);
      const card = createTestCard({ id: 'card1', nid: 'note1', did: deck.id });
      db.addCard(card);
      
      await deckService.deleteDeck(deck.id, { deleteCards: true });
      
      expect(db.getDeck(deck.id)).toBeUndefined();
      expect(db.getCard('card1')).toBeUndefined();
    });

    it('should move cards to another deck instead of deleting', async () => {
      const deck1 = deckService.createDeck('Source Deck');
      const deck2 = deckService.createDeck('Target Deck');
      
      const note = createTestNote({ id: 'note1' });
      db.addNote(note);
      const card = createTestCard({ id: 'card1', nid: 'note1', did: deck1.id });
      db.addCard(card);
      
      await deckService.deleteDeck(deck1.id, { moveCardsTo: deck2.id });
      
      expect(db.getDeck(deck1.id)).toBeUndefined();
      expect(db.getCard('card1')).toBeDefined();
      expect(db.getCard('card1')?.did).toBe(deck2.id);
    });

    it('should not allow deleting default deck', async () => {
      await expect(
        deckService.deleteDeck('1', { deleteCards: true })
      ).rejects.toThrow('Cannot delete default deck');
    });

    it('should cleanup orphaned media when deleting deck', async () => {
      const deck = deckService.createDeck('Test Deck');
      
      // Create note with media in this deck
      const note = createTestNote({
        id: 'note1',
        flds: '<img src="deck-image.jpg">\x1fBack',
      });
      db.addNote(note);
      
      const card = createTestCard({ id: 'card1', nid: 'note1', did: deck.id });
      db.addCard(card);
      
      const media = {
        id: 'media1',
        filename: 'deck-image.jpg',
        hash: 'hash123',
        mime: 'image/jpeg',
        size: 1024,
        localUri: 'file://deck-image.jpg',
        created: 123456,
      };
      db.addMedia(media);
      
      await deckService.deleteDeck(deck.id, { deleteCards: true });
      
      // Media should be cleaned up
      expect(db.getAllMedia().length).toBe(0);
    });
  });

  describe('Get Deck Stats', () => {
    it('should calculate deck statistics', () => {
      const deck = deckService.createDeck('Stats Deck');
      
      // Add various card types
      const note1 = createTestNote({ id: 'note1' });
      const note2 = createTestNote({ id: 'note2' });
      const note3 = createTestNote({ id: 'note3' });
      db.addNote(note1);
      db.addNote(note2);
      db.addNote(note3);
      
      db.addCard(createTestCard({ id: 'card1', nid: 'note1', did: deck.id, type: CardType.New }));
      db.addCard(createTestCard({ id: 'card2', nid: 'note2', did: deck.id, type: CardType.Learning }));
      db.addCard(createTestCard({ id: 'card3', nid: 'note3', did: deck.id, type: CardType.Review }));
      
      const stats = db.getStats(deck.id);
      expect(stats.newCount).toBe(1);
      expect(stats.learningCount).toBe(1);
      expect(stats.reviewCount).toBe(1);
      expect(stats.totalCards).toBe(3);
    });

    it('should return zero stats for empty deck', () => {
      const deck = deckService.createDeck('Empty Deck');
      
      const stats = db.getStats(deck.id);
      expect(stats.totalCards).toBe(0);
      expect(stats.newCount).toBe(0);
    });
  });

  describe('Deck Hierarchy', () => {
    it('should support parent::child deck names', () => {
      const parent = deckService.createDeck('Parent');
      const child = deckService.createDeck('Parent::Child');
      
      expect(parent.name).toBe('Parent');
      expect(child.name).toBe('Parent::Child');
    });

    it('should list all decks', () => {
      deckService.createDeck('Deck A');
      deckService.createDeck('Deck B');
      deckService.createDeck('Deck C');
      
      const allDecks = db.getAllDecks();
      // Should include default deck + 3 new decks
      expect(allDecks.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('Deck Config', () => {
    it('should use default config for new decks', () => {
      const deck = deckService.createDeck('Test Deck');
      
      expect(deck.conf).toBe('1');
      const config = db.getDeckConfig('1');
      expect(config).toBeDefined();
      expect(config?.name).toBe('Default');
    });

    it('should retrieve deck config', () => {
      const deck = deckService.createDeck('Test Deck');
      const config = db.getDeckConfigForDeck(deck.id);
      
      expect(config).toBeDefined();
      expect(config?.new.perDay).toBe(20); // Default new cards per day
      expect(config?.rev.perDay).toBe(200); // Default reviews per day
    });
  });

  describe('Error Handling', () => {
    it('should throw error when renaming nonexistent deck', () => {
      expect(() => {
        deckService.renameDeck('fake-id', 'New Name');
      }).toThrow();
    });

    it('should throw error when deleting nonexistent deck', async () => {
      await expect(
        deckService.deleteDeck('fake-id', { deleteCards: true })
      ).rejects.toThrow();
    });

    it('should handle empty deck name', () => {
      expect(() => {
        deckService.createDeck('');
      }).toThrow();
    });
  });

  describe('Child Deck Deletion', () => {
    it('should delete child decks when deleting parent', async () => {
      const parent = deckService.createDeck('Parent');
      const child1 = deckService.createDeck('Parent::Child1');
      const child2 = deckService.createDeck('Parent::Child2');
      
      await deckService.deleteDeck(parent.id, { deleteCards: true });
      
      // Parent and children should all be deleted
      expect(db.getDeck(parent.id)).toBeUndefined();
      expect(db.getDeck(child1.id)).toBeUndefined();
      expect(db.getDeck(child2.id)).toBeUndefined();
    });

    it('should move cards from child decks when deleting parent', async () => {
      const parent = deckService.createDeck('Parent');
      const child = deckService.createDeck('Parent::Child');
      const targetDeck = deckService.createDeck('Target');
      
      // Add card to child deck
      const note = createTestNote({ id: 'note1' });
      db.addNote(note);
      db.addCard(createTestCard({ id: 'card1', nid: 'note1', did: child.id }));
      
      await deckService.deleteDeck(parent.id, { moveCardsTo: targetDeck.id });
      
      // Card should be moved to target deck
      expect(db.getCard('card1')?.did).toBe(targetDeck.id);
    });
  });
});
