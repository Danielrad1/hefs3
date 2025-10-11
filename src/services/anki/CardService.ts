/**
 * CardService - High-level operations for card management
 */

import { InMemoryDb } from './InMemoryDb';
import { AnkiCard, CardQueue } from './schema';
import { isDue } from './time';
import { MediaService } from './MediaService';

export interface CardQuery {
  deck?: string;
  tag?: string;
  note?: string;
  flag?: number;
  is?: 'new' | 'learn' | 'review' | 'suspended' | 'buried' | 'due';
  prop?: { type: 'factor' | 'ivl' | 'reps' | 'lapses'; value: number; op: 'eq' | 'gt' | 'lt' | 'gte' | 'lte' };
  rated?: number; // cards reviewed in last N days
  added?: number; // cards added in last N days
}

export class CardService {
  private mediaService: MediaService;

  constructor(private db: InMemoryDb) {
    this.mediaService = new MediaService(db);
  }

  /**
   * Find cards matching query
   */
  findCards(query: CardQuery): AnkiCard[] {
    let cards = this.db.getAllCards();

    // Filter by deck
    if (query.deck) {
      cards = cards.filter((c) => {
        const deck = this.db.getDeck(c.did);
        return deck && (deck.name === query.deck || deck.name.startsWith(query.deck + '::'));
      });
    }

    // Filter by tag
    if (query.tag) {
      cards = cards.filter((c) => {
        const note = this.db.getNote(c.nid);
        return note && note.tags.includes(` ${query.tag} `);
      });
    }

    // Filter by note type
    if (query.note) {
      cards = cards.filter((c) => {
        const note = this.db.getNote(c.nid);
        if (!note) return false;
        const model = this.db.getModel(note.mid);
        return model && model.name === query.note;
      });
    }

    // Filter by flag
    if (query.flag !== undefined) {
      cards = cards.filter((c) => c.flags === query.flag);
    }

    // Filter by state
    if (query.is) {
      const col = this.db.getCol();
      cards = cards.filter((c) => {
        switch (query.is) {
          case 'new':
            return c.type === 0;
          case 'learn':
            return c.type === 1 || c.type === 3;
          case 'review':
            return c.type === 2;
          case 'suspended':
            return c.queue === CardQueue.Suspended;
          case 'buried':
            return c.queue === CardQueue.UserBuried || c.queue === CardQueue.SchedBuried;
          case 'due':
            // Use proper isDue logic from time.ts
            return isDue(c.due, c.type, col);
          default:
            return true;
        }
      });
    }

    // Filter by property
    if (query.prop) {
      cards = cards.filter((c) => {
        const value = c[query.prop!.type];
        const target = query.prop!.value;
        
        switch (query.prop!.op) {
          case 'eq':
            return value === target;
          case 'gt':
            return value > target;
          case 'lt':
            return value < target;
          case 'gte':
            return value >= target;
          case 'lte':
            return value <= target;
          default:
            return true;
        }
      });
    }

    // Filter by rated (reviewed in last N days)
    if (query.rated !== undefined) {
      const cutoff = Date.now() - query.rated * 24 * 60 * 60 * 1000;
      const cardIds = new Set(
        this.db.getAllRevlog()
          .filter((r) => parseInt(r.id) >= cutoff)
          .map((r) => r.cid)
      );
      cards = cards.filter((c) => cardIds.has(c.id));
    }

    // Filter by added (created in last N days)
    if (query.added !== undefined) {
      const cutoff = Math.floor(Date.now() / 1000) - query.added * 24 * 60 * 60;
      cards = cards.filter((c) => c.mod >= cutoff);
    }

    return cards;
  }

  /**
   * Get a single card
   */
  getCard(id: string): AnkiCard | undefined {
    return this.db.getCard(id);
  }

  /**
   * Update a card
   */
  updateCard(cardId: string, patch: Partial<AnkiCard>): void {
    this.db.updateCard(cardId, patch);
  }

  /**
   * Move cards to a different deck
   */
  moveCards(cardIds: string[], targetDeckId: string): void {
    const targetDeck = this.db.getDeck(targetDeckId);
    if (!targetDeck) {
      throw new Error(`Target deck ${targetDeckId} not found`);
    }

    cardIds.forEach((cardId) => {
      this.db.updateCard(cardId, { did: targetDeckId });
    });
  }

  /**
   * Suspend cards
   */
  suspend(cardIds: string[]): void {
    cardIds.forEach((cardId) => {
      this.db.updateCard(cardId, { queue: CardQueue.Suspended });
    });
  }

  /**
   * Unsuspend cards (restore to appropriate queue)
   */
  unsuspend(cardIds: string[]): void {
    cardIds.forEach((cardId) => {
      const card = this.db.getCard(cardId);
      if (!card) return;

      // Restore queue based on card type
      let queue: CardQueue;
      switch (card.type) {
        case 0: // new
          queue = CardQueue.New;
          break;
        case 1: // learning
        case 3: // relearning
          queue = CardQueue.Learning;
          break;
        case 2: // review
          queue = CardQueue.Review;
          break;
        default:
          queue = CardQueue.New;
      }

      this.db.updateCard(cardId, { queue });
    });
  }

  /**
   * Set flag on cards (0=none, 1=red, 2=orange, 3=green, 4=blue)
   */
  setFlag(cardIds: string[], flag: number): void {
    if (flag < 0 || flag > 4) {
      throw new Error('Flag must be between 0 and 4');
    }

    cardIds.forEach((cardId) => {
      this.db.updateCard(cardId, { flags: flag });
    });
  }

  /**
   * Set due date for cards (days from today)
   */
  setDue(cardIds: string[], daysFromNow: number): void {
    const col = this.db.getCol();
    const daysSinceCreation = Math.floor((Date.now() / 1000 - col.crt) / 86400);
    const newDue = daysSinceCreation + daysFromNow;

    cardIds.forEach((cardId) => {
      this.db.updateCard(cardId, { due: newDue });
    });
  }

  /**
   * Delete cards (and orphaned notes)
   */
  async deleteCards(cardIds: string[]): Promise<void> {
    const noteIds = new Set<string>();

    // Collect note IDs and delete cards
    cardIds.forEach((cardId) => {
      const card = this.db.getCard(cardId);
      if (card) {
        noteIds.add(card.nid);
        this.db.deleteCard(cardId);
      }
    });

    // Delete notes that have no remaining cards
    noteIds.forEach((noteId) => {
      const remainingCards = this.db.getAllCards().filter((c) => c.nid === noteId);
      if (remainingCards.length === 0) {
        this.db.deleteNote(noteId);
      }
    });
    
    // Clean up orphaned media files
    console.log('[CardService] Cleaning up orphaned media files...');
    const deletedCount = await this.mediaService.gcUnused();
    console.log(`[CardService] Deleted ${deletedCount} orphaned media files`);
  }
}
