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
  async deleteDeck(
    id: string,
    options?: { moveCardsTo?: string; deleteCards?: boolean },
    onProgress?: (message: string) => void
  ): Promise<void> {
    if (id === DEFAULT_DECK_ID) {
      throw new Error('Cannot delete default deck');
    }

    const deck = this.db.getDeck(id);
    if (!deck) {
      throw new Error(`Deck ${id} not found`);
    }

    // Handle cards in this deck
    const cards = [...this.db.getCardsByDeck(id)];
    const emitProgress = (message: string) => {
      if (!message) return;
      onProgress?.(message);
      logger.info(`[DeckService] ${message}`);
    };
    const yieldEvery = async (index: number, interval = 2000) => {
      if (index > 0 && index % interval === 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
    };
    
    let noteUsageIndex: Map<string, number> | null = null;
    let totalDeletedNotes = 0;
    const decrementNoteCount = (noteId: string, context: string): { deleted: boolean; remaining: number } => {
      if (!noteUsageIndex) {
        return { deleted: false, remaining: 0 };
      }
      const prev = noteUsageIndex.get(noteId);
      if (prev === undefined) {
        logger.warn(`[DeckService] Note ${noteId} missing in usage index while deleting card from ${context}; recomputing from DB snapshot.`);
        const remaining = this.db.getAllCards().filter((c) => c.nid === noteId).length;
        if (remaining <= 0) {
          this.db.deleteNote(noteId);
          return { deleted: true, remaining: 0 };
        }
        noteUsageIndex.set(noteId, remaining);
        return { deleted: false, remaining };
      }
      const next = prev - 1;
      if (next <= 0) {
        noteUsageIndex.delete(noteId);
        this.db.deleteNote(noteId);
        logger.info(`[DeckService] Deleted note ${noteId} after removing final card from ${context}`);
        return { deleted: true, remaining: 0 };
      }
      noteUsageIndex.set(noteId, next);
      return { deleted: false, remaining: next };
    };

    if (options?.deleteCards) {
      const indexStart = Date.now();
      const allCardsSnapshot = this.db.getAllCards();
      noteUsageIndex = new Map<string, number>();
      for (const card of allCardsSnapshot) {
        noteUsageIndex.set(card.nid, (noteUsageIndex.get(card.nid) ?? 0) + 1);
      }
      logger.info(`[DeckService] Built note usage index for ${noteUsageIndex.size} notes from ${allCardsSnapshot.length} cards in ${Date.now() - indexStart}ms`);

      // Actually delete cards and their notes
      emitProgress('Deleting cards (0/' + cards.length + ')...');
      logger.info(`[DeckService] Removing ${cards.length} cards from deck "${deck.name}" (${deck.id})`);
      const cardDeletionStart = Date.now();
      let deletedNotes = 0;
      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        this.db.deleteCard(card.id);
        const { deleted } = decrementNoteCount(card.nid, `deck "${deck.name}"`);
        if (deleted) {
          deletedNotes++;
        }
        if ((i + 1) % 500 === 0 || i + 1 === cards.length) {
          emitProgress(`Deleting cards (${i + 1}/${cards.length})...`);
        }
        await yieldEvery(i);
      }
      logger.info(`[DeckService] Removed ${cards.length} cards from deck "${deck.name}" in ${Date.now() - cardDeletionStart}ms (deleted notes: ${deletedNotes})`);
      
      totalDeletedNotes += deletedNotes;
      emitProgress(`Deleted ${deletedNotes} notes from deck "${deck.name}"`);
    } else if (options?.moveCardsTo) {
      // Move cards to target deck
      const targetDeck = this.db.getDeck(options.moveCardsTo);
      if (!targetDeck) {
        throw new Error(`Target deck ${options.moveCardsTo} not found`);
      }
      emitProgress('Moving cards to selected deck...');
      logger.info(`[DeckService] Moving ${cards.length} cards from deck "${deck.name}" (${deck.id}) to deck "${targetDeck.name}" (${targetDeck.id}).`);
      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        this.db.updateCard(card.id, { did: options.moveCardsTo });
        await yieldEvery(i);
      }
    } else {
      // Move cards to default deck
      emitProgress('Moving cards to default deck...');
      logger.info(`[DeckService] Moving ${cards.length} cards from deck "${deck.name}" (${deck.id}) to default deck (${DEFAULT_DECK_ID}).`);
      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        this.db.updateCard(card.id, { did: DEFAULT_DECK_ID });
        await yieldEvery(i);
      }
    }

    // Delete child decks
    const prefix = deck.name + '::';
    const childDecks = this.db.getAllDecks().filter((d) => d.name.startsWith(prefix));
    if (childDecks.length > 0) {
      logger.info(`[DeckService] Found ${childDecks.length} child decks under "${deck.name}" for cascading delete.`);
    }
    
    for (let childIndex = 0; childIndex < childDecks.length; childIndex++) {
      const child = childDecks[childIndex];
      const childCards = [...this.db.getCardsByDeck(child.id)];
      emitProgress(`Deleting deck "${child.name}"...`);
      logger.info(`[DeckService] Deleting deck "${child.name}" (${child.id}) with ${childCards.length} cards.`);
      
      if (options?.deleteCards) {
        const childDeletionStart = Date.now();
        let childDeletedNotes = 0;
        for (let i = 0; i < childCards.length; i++) {
          const card = childCards[i];
          this.db.deleteCard(card.id);
          const { deleted } = decrementNoteCount(card.nid, `child deck "${child.name}"`);
          if (deleted) {
            childDeletedNotes++;
          }
          if ((i + 1) % 500 === 0 || i + 1 === childCards.length) {
            emitProgress(`Deleting cards from "${child.name}" (${i + 1}/${childCards.length})...`);
          }
          await yieldEvery(i);
        }
        totalDeletedNotes += childDeletedNotes;
        logger.info(`[DeckService] Child deck "${child.name}" card deletion completed in ${Date.now() - childDeletionStart}ms (deleted notes: ${childDeletedNotes})`);
        emitProgress(`Deleted ${childDeletedNotes} notes from "${child.name}"`);
      } else {
        const targetDeckId = options?.moveCardsTo || DEFAULT_DECK_ID;
        for (let i = 0; i < childCards.length; i++) {
          const card = childCards[i];
          this.db.updateCard(card.id, { did: targetDeckId });
          await yieldEvery(i);
        }
      }
      
      this.db.deleteDeck(child.id);
      await yieldEvery(childIndex);
    }

    // Delete the deck itself
    this.db.deleteDeck(id);
    
    // Clean up orphaned media files
    if (options?.deleteCards) {
      const msg = '[DeckService] Cleaning up orphaned media files...';
      logger.info(msg);
      emitProgress('Cleaning up media files...');
      const deletedCount = await this.mediaService.gcUnused(onProgress);
      logger.info(`[DeckService] Deleted ${deletedCount} orphaned media files (total notes deleted: ${totalDeletedNotes})`);
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
