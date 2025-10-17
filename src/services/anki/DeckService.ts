/**
 * DeckService - High-level operations for deck management
 */

import { InMemoryDb } from './InMemoryDb';
import { Deck, DEFAULT_DECK_ID } from './schema';
import { nowSeconds, generateId } from './time';
import { MediaService } from './MediaService';
import { logger } from '../../utils/logger';

export class DeckService {
  private mediaService: MediaService;

  constructor(private db: InMemoryDb) {
    this.mediaService = new MediaService(db);
  }

  /**
   * List all decks
   */
  listDecks(): Deck[] {
    return this.db.getAllDecks();
  }

  /**
   * Get a single deck by ID
   */
  getDeck(id: string): Deck | undefined {
    return this.db.getDeck(id);
  }

  /**
   * Create a new deck with Parent::Child support
   */
  createDeck(name: string, description?: string): Deck {
    // Validate deck name
    if (!name || name.trim() === '') {
      throw new Error('Deck name required');
    }

    // Ensure parent decks exist
    this.ensureParentDecks(name);

    const now = nowSeconds();
    const deck: Deck = {
      id: generateId(),
      name,
      desc: description || '',
      conf: '1', // Use default deck config
      mod: now,
      usn: -1,
      collapsed: false,
      browserCollapsed: false,
    };

    this.db.addDeck(deck);
    return deck;
  }

  /**
   * Rename a deck (handles Parent::Child hierarchy)
   */
  renameDeck(id: string, newName: string): void {
    // Cannot rename default deck
    if (id === DEFAULT_DECK_ID) {
      throw new Error('Cannot rename default deck');
    }

    const deck = this.db.getDeck(id);
    if (!deck) {
      throw new Error(`Deck ${id} not found`);
    }

    // Ensure parent decks exist for new name
    this.ensureParentDecks(newName);

    // Update deck name
    this.db.updateDeck(id, { name: newName });

    // Update child decks if this is a parent
    const oldPrefix = deck.name + '::';
    const newPrefix = newName + '::';
    
    this.db.getAllDecks().forEach((d) => {
      if (d.name.startsWith(oldPrefix)) {
        const childSuffix = d.name.substring(oldPrefix.length);
        const newChildName = newPrefix + childSuffix;
        this.db.updateDeck(d.id, { name: newChildName });
      }
    });
  }

  /**
   * Delete a deck and optionally move cards to another deck
   */
  async deleteDeck(id: string, options?: { moveCardsTo?: string; deleteCards?: boolean }): Promise<void> {
    if (id === DEFAULT_DECK_ID) {
      throw new Error('Cannot delete default deck');
    }

    const deck = this.db.getDeck(id);
    if (!deck) {
      throw new Error(`Deck ${id} not found`);
    }

    // Handle cards in this deck
    const cards = this.db.getCardsByDeck(id);
    
    if (options?.deleteCards) {
      // Actually delete cards and their notes
      const noteIds = new Set<string>();
      cards.forEach((card) => {
        noteIds.add(card.nid);
        this.db.deleteCard(card.id);
      });
      
      // Delete notes that are no longer used
      noteIds.forEach((noteId) => {
        const remainingCards = this.db.getAllCards().filter(c => c.nid === noteId);
        if (remainingCards.length === 0) {
          this.db.deleteNote(noteId);
        }
      });
    } else if (options?.moveCardsTo) {
      // Move cards to target deck
      const targetDeck = this.db.getDeck(options.moveCardsTo);
      if (!targetDeck) {
        throw new Error(`Target deck ${options.moveCardsTo} not found`);
      }
      
      cards.forEach((card) => {
        this.db.updateCard(card.id, { did: options.moveCardsTo });
      });
    } else {
      // Move cards to default deck
      cards.forEach((card) => {
        this.db.updateCard(card.id, { did: DEFAULT_DECK_ID });
      });
    }

    // Delete child decks
    const prefix = deck.name + '::';
    const childDecks = this.db.getAllDecks().filter((d) => d.name.startsWith(prefix));
    
    childDecks.forEach((child) => {
      const childCards = this.db.getCardsByDeck(child.id);
      
      if (options?.deleteCards) {
        const noteIds = new Set<string>();
        childCards.forEach((card) => {
          noteIds.add(card.nid);
          this.db.deleteCard(card.id);
        });
        
        noteIds.forEach((noteId) => {
          const remainingCards = this.db.getAllCards().filter(c => c.nid === noteId);
          if (remainingCards.length === 0) {
            this.db.deleteNote(noteId);
          }
        });
      } else {
        const targetDeckId = options?.moveCardsTo || DEFAULT_DECK_ID;
        childCards.forEach((card) => {
          this.db.updateCard(card.id, { did: targetDeckId });
        });
      }
      
      this.db.deleteDeck(child.id);
    });

    // Delete the deck itself
    this.db.deleteDeck(id);
    
    // Clean up orphaned media files
    if (options?.deleteCards) {
      logger.info('[DeckService] Cleaning up orphaned media files...');
      const deletedCount = await this.mediaService.gcUnused();
      logger.info(`[DeckService] Deleted ${deletedCount} orphaned media files`);
    }
  }

  /**
   * Set collapsed state for a deck
   */
  setCollapsed(id: string, collapsed: boolean): void {
    this.db.updateDeck(id, { collapsed });
  }

  /**
   * Get deck statistics
   */
  getStats(deckId: string) {
    return this.db.getStats(deckId);
  }

  /**
   * Parse hierarchy from deck name (e.g., "Parent::Child" => ["Parent", "Child"])
   */
  parseHierarchy(name: string): string[] {
    return name.split('::');
  }

  /**
   * Ensure all parent decks exist for a given deck name
   * E.g., for "A::B::C", creates "A" and "A::B" if they don't exist
   */
  private ensureParentDecks(name: string): void {
    const parts = this.parseHierarchy(name);
    
    for (let i = 0; i < parts.length - 1; i++) {
      const parentName = parts.slice(0, i + 1).join('::');
      
      // Check if parent deck exists
      const existingDeck = this.db.getAllDecks().find((d) => d.name === parentName);
      
      if (!existingDeck) {
        // Create parent deck
        const now = nowSeconds();
        const parentDeck: Deck = {
          id: generateId(),
          name: parentName,
          desc: '',
          conf: '1',
          mod: now,
          usn: -1,
          collapsed: false,
          browserCollapsed: false,
        };
        
        this.db.addDeck(parentDeck);
      }
    }
  }
}
