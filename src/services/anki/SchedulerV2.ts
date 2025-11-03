/**
 * Anki V2 Scheduler
 * Implements SM-2 algorithm with learning steps
 */

import {
  AnkiCard,
  AnkiRevlog,
  CardType,
  CardQueue,
  RevlogEase,
  RevlogType,
  DeckConfig,
  MIN_EASE_FACTOR,
} from './schema';
import { InMemoryDb } from './InMemoryDb';
import {
  nowSeconds,
  nowMillis,
  generateId,
  daysSinceCrt,
  addMinutes,
  isDue,
} from './time';
import { TodayCountsService } from './TodayCountsService';
import { selectAlgorithm, AlgorithmHelpers } from './algorithms';

// Re-export isDue for use by other services
export { isDue } from './time';

export class SchedulerV2 {
  // Session-based buried note IDs (to prevent sibling cards from showing)
  private buriedNoteIds: Set<string> = new Set();
  private buriedCardQueues: Map<string, CardQueue> = new Map();
  private todayCountsService: TodayCountsService;

  /**
   * @param db - The in-memory database
   * @param rng - Random number generator function (0-1). Defaults to Math.random.
   *              Inject a seeded RNG for deterministic tests.
   */
  constructor(
    private db: InMemoryDb,
    private rng: () => number = Math.random
  ) {
    this.todayCountsService = new TodayCountsService(db);
  }

  // ==========================================================================
  // QUEUE SELECTION
  // ==========================================================================

  /**
   * Get the next card to study from a deck
   */
  getNext(deckId?: string): AnkiCard | null {
    const col = this.db.getCol();
    const now = nowSeconds();

    const cards = deckId
      ? this.db.getCardsByDeck(deckId)
      : this.db.getAllCards();

    console.log(`[SchedulerV2] getNext: Total cards: ${cards.length}, Buried note IDs: ${this.buriedNoteIds.size}`, Array.from(this.buriedNoteIds));

    // Filter out suspended, buried, and session-buried siblings
    const activeCards = cards.filter(
      (c) => c.queue !== CardQueue.Suspended &&
             c.queue !== CardQueue.UserBuried &&
             c.queue !== CardQueue.SchedBuried &&
             !this.buriedNoteIds.has(c.nid)
    );
    
    console.log(`[SchedulerV2] getNext: Active cards after filtering: ${activeCards.length}`);

    // Prioritize: learning > review > new
    
    // 1. Learning cards (due now)
    const learning = activeCards
      .filter((c) => 
        (c.queue === CardQueue.Learning || c.queue === CardQueue.DayLearn) &&
        isDue(c.due, c.type, col, now)
      )
      .sort((a, b) => a.due - b.due);
    
    if (learning.length > 0) {
      return learning[0];
    }

    // 2. Review cards (due now) - check daily limit
    if (deckId) {
      const capacity = this.todayCountsService.getRemainingCapacity(deckId, now * 1000);
      if (capacity.canShowReview) {
        const reviews = activeCards
          .filter((c) => 
            c.queue === CardQueue.Review &&
            isDue(c.due, c.type, col, now)
          )
          .sort((a, b) => a.due - b.due);
        
        if (reviews.length > 0) {
          return reviews[0];
        }
      }
    } else {
      // No deck filter - show reviews without limit check
      const reviews = activeCards
        .filter((c) => 
          c.queue === CardQueue.Review &&
          isDue(c.due, c.type, col, now)
        )
        .sort((a, b) => a.due - b.due);
      
      if (reviews.length > 0) {
        return reviews[0];
      }
    }

    // 3. New cards (FIFO by due order) - check daily limit
    if (deckId) {
      const capacity = this.todayCountsService.getRemainingCapacity(deckId, now * 1000);
      if (capacity.canShowNew) {
        const newCards = activeCards
          .filter((c) => c.queue === CardQueue.New)
          .sort((a, b) => a.due - b.due);
        
        if (newCards.length > 0) {
          return newCards[0];
        }
      }
    } else {
      // No deck filter - show new without limit check
      const newCards = activeCards
        .filter((c) => c.queue === CardQueue.New)
        .sort((a, b) => a.due - b.due);
      
      if (newCards.length > 0) {
        return newCards[0];
      }
    }

    return null;
  }

  /**
   * Bury siblings of the current card for this session
   */
  burySiblings(cardId: string): void {
    const card = this.db.getCard(cardId);
    if (!card) return;

    // Add note ID to buried set
    this.buriedNoteIds.add(card.nid);

    // Temporarily mark sibling cards as user-buried to keep counts accurate
    const siblings = this.db
      .getAllCards()
      .filter((c) => c.nid === card.nid && c.id !== cardId);

    siblings.forEach((sibling) => {
      if (!this.buriedCardQueues.has(sibling.id)) {
        this.buriedCardQueues.set(sibling.id, sibling.queue);
        this.db.updateCard(sibling.id, { queue: CardQueue.UserBuried });
      }
    });
  }

  /**
   * Clear session-buried notes (call when switching decks or starting new session)
   */
  clearBuriedSiblings(): void {
    this.buriedNoteIds.clear();
    if (this.buriedCardQueues.size > 0) {
      this.buriedCardQueues.forEach((originalQueue, cardId) => {
        this.db.updateCard(cardId, { queue: originalQueue });
      });
      this.buriedCardQueues.clear();
    }
  }

  /**
   * Get buried note IDs count
   */
  getBuriedCount(): number {
    return this.buriedNoteIds.size;
  }

  /**
   * Peek at the next card without removing from queue
   * Returns the second card in queue (after current)
   */
  peekNext(deckId?: string): AnkiCard | null {
    const col = this.db.getCol();
    const now = nowSeconds();

    const cards = deckId
      ? this.db.getCardsByDeck(deckId)
      : this.db.getAllCards();

    console.log(`[SchedulerV2] peekNext: Total cards: ${cards.length}, Buried note IDs: ${this.buriedNoteIds.size}`, Array.from(this.buriedNoteIds));

    // Filter out suspended, buried, and session-buried siblings
    const activeCards = cards.filter(
      (c) => c.queue !== CardQueue.Suspended &&
             c.queue !== CardQueue.UserBuried &&
             c.queue !== CardQueue.SchedBuried &&
             !this.buriedNoteIds.has(c.nid)
    );
    
    console.log(`[SchedulerV2] peekNext: Active cards after filtering: ${activeCards.length}`);

    // Get all due cards (same priority as getNext)
    const allDue = [
      // Learning cards
      ...activeCards
        .filter((c) => 
          (c.queue === CardQueue.Learning || c.queue === CardQueue.DayLearn) &&
          isDue(c.due, c.type, col, now)
        )
        .sort((a, b) => a.due - b.due),
      // Review cards
      ...activeCards
        .filter((c) => 
          c.queue === CardQueue.Review &&
          isDue(c.due, c.type, col, now)
        )
        .sort((a, b) => a.due - b.due),
      // New cards
      ...activeCards
        .filter((c) => c.queue === CardQueue.New)
        .sort((a, b) => a.due - b.due),
    ];
    
    // Return second card (index 1)
    return allDue.length > 1 ? allDue[1] : null;
  }

  // ==========================================================================
  // ANSWER PROCESSING
  // ==========================================================================

  /**
   * Answer a card and update its scheduling
   * Delegates to the selected algorithm (SM-2, FSRS, Leitner, AI)
   */
  answer(
    cardId: string,
    ease: RevlogEase,
    responseTimeMs: number
  ): void {
    const card = this.db.getCard(cardId);
    if (!card) {
      throw new Error(`Card ${cardId} not found`);
    }

    const col = this.db.getCol();
    const deckConfig = this.db.getDeckConfigForDeck(card.did);
    if (!deckConfig) {
      throw new Error(`Deck config not found for deck ${card.did}`);
    }

    const now = nowSeconds();
    const lastIvl = card.ivl;
    const lastFactor = card.factor;
    const oldType = card.type;

    // Select algorithm based on deck config
    const algorithm = selectAlgorithm(deckConfig);

    // Build helpers for algorithm
    const helpers: AlgorithmHelpers = {
      nowSeconds: now,
      colCrt: col.crt,
      rng: this.rng,
      addMinutes: (nowSec: number, minutes: number) => addMinutes(nowSec, minutes),
      daysSinceCrt: (nowSec: number) => daysSinceCrt(col, nowSec),
    };

    // Delegate to algorithm
    const newCard = algorithm.scheduleAnswer(card, ease, deckConfig, helpers);

    // Update card in database
    this.db.updateCard(cardId, newCard);

    // Determine revlog type based on old type
    let revlogType: RevlogType;
    if (oldType === CardType.New || oldType === CardType.Learning) {
      revlogType = RevlogType.Learn;
    } else if (oldType === CardType.Review) {
      revlogType = RevlogType.Review;
    } else if (oldType === CardType.Relearning) {
      revlogType = RevlogType.Relearn;
    } else {
      revlogType = RevlogType.Learn;
    }

    // Add revlog entry (ID must be timestamp in milliseconds for stats calculation)
    const updatedCard = { ...card, ...newCard };
    const revlogEntry: AnkiRevlog = {
      id: Date.now().toString(), // Use timestamp directly, not generateId()
      cid: cardId,
      usn: -1,
      ease,
      ivl: this.revlogIvl(updatedCard, newCard.type ?? card.type),
      lastIvl: this.revlogIvl(card, card.type),
      factor: newCard.factor ?? lastFactor,
      time: responseTimeMs,
      type: revlogType,
    };

    this.db.addRevlog(revlogEntry);
  }

  // ==========================================================================
  // UTILITIES
  // ==========================================================================

  /**
   * Convert interval to revlog format
   * Negative=seconds for learning, positive=days for review
   */
  private revlogIvl(card: AnkiCard, type: CardType): number {
    if (type === CardType.Learning || type === CardType.Relearning) {
      // Negative seconds
      const now = nowSeconds();
      return -(card.due - now);
    } else {
      // Positive days
      return card.ivl;
    }
  }
}
