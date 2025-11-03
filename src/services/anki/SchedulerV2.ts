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

    // Process based on card type
    let newCard: Partial<AnkiCard>;
    let revlogType: RevlogType;

    if (card.type === CardType.New) {
      newCard = this.answerNew(card, ease, deckConfig, now);
      revlogType = RevlogType.Learn;
    } else if (card.type === CardType.Learning) {
      newCard = this.answerLearning(card, ease, deckConfig, now);
      revlogType = RevlogType.Learn;
    } else if (card.type === CardType.Review) {
      newCard = this.answerReview(card, ease, deckConfig, now);
      revlogType = RevlogType.Review;
    } else if (card.type === CardType.Relearning) {
      newCard = this.answerRelearning(card, ease, deckConfig, now);
      revlogType = RevlogType.Relearn;
    } else {
      throw new Error(`Unknown card type: ${card.type}`);
    }

    // Update card in database
    this.db.updateCard(cardId, newCard);

    // Add revlog entry (ID must be timestamp in milliseconds for stats calculation)
    const revlogEntry: AnkiRevlog = {
      id: Date.now().toString(), // Use timestamp directly, not generateId()
      cid: cardId,
      usn: -1,
      ease,
      ivl: this.revlogIvl(newCard as AnkiCard, newCard.type ?? card.type),
      lastIvl: this.revlogIvl(card, card.type),
      factor: newCard.factor ?? lastFactor,
      time: responseTimeMs,
      type: revlogType,
    };

    this.db.addRevlog(revlogEntry);
  }

  // ==========================================================================
  // ANSWER LOGIC BY TYPE
  // ==========================================================================

  private answerNew(
    card: AnkiCard,
    ease: RevlogEase,
    config: DeckConfig,
    now: number
  ): Partial<AnkiCard> {
    // Start learning
    const delays = config.new.delays;

    if (ease === RevlogEase.Again) {
      // First learning step
      return {
        type: CardType.Learning,
        queue: CardQueue.Learning,
        due: addMinutes(now, delays[0]),
        ivl: 0,
        factor: config.new.initialFactor,
        reps: card.reps + 1,
        left: this.setLeft(delays.length, delays.length),
      };
    } else if (ease === RevlogEase.Good) {
      // Move through learning steps or graduate
      if (delays.length > 1) {
        // Second learning step
        return {
          type: CardType.Learning,
          queue: CardQueue.Learning,
          due: addMinutes(now, delays[1]),
          ivl: 0,
          factor: config.new.initialFactor,
          reps: card.reps + 1,
          left: this.setLeft(delays.length - 1, delays.length),
        };
      } else {
        // Graduate immediately
        const col = this.db.getCol();
        const graduatingIvl = config.new.ints[0];
        return {
          type: CardType.Review,
          queue: CardQueue.Review,
          due: daysSinceCrt(col, now) + graduatingIvl,
          ivl: graduatingIvl,
          factor: config.new.initialFactor,
          reps: card.reps + 1,
          left: 0,
        };
      }
    } else if (ease === RevlogEase.Easy) {
      // Graduate with easy interval
      const col = this.db.getCol();
      const easyIvl = config.new.ints[1];
      return {
        type: CardType.Review,
        queue: CardQueue.Review,
        due: daysSinceCrt(col, now) + easyIvl,
        ivl: easyIvl,
        factor: config.new.initialFactor + config.rev.ease4,
        reps: card.reps + 1,
        left: 0,
      };
    }

    // Default (shouldn't reach)
    return {};
  }

  private answerLearning(
    card: AnkiCard,
    ease: RevlogEase,
    config: DeckConfig,
    now: number
  ): Partial<AnkiCard> {
    const delays = config.new.delays;
    const [repsLeft, stepsTotal] = this.getLeft(card.left);

    if (ease === RevlogEase.Again) {
      // Restart learning
      return {
        type: CardType.Learning,
        queue: CardQueue.Learning,
        due: addMinutes(now, delays[0]),
        ivl: 0,
        reps: card.reps + 1,
        left: this.setLeft(stepsTotal, stepsTotal),
      };
    } else if (ease === RevlogEase.Good) {
      const currentStepIndex = stepsTotal - repsLeft;
      
      if (currentStepIndex + 1 < delays.length) {
        // Next learning step
        return {
          type: CardType.Learning,
          queue: CardQueue.Learning,
          due: addMinutes(now, delays[currentStepIndex + 1]),
          ivl: 0,
          reps: card.reps + 1,
          left: this.setLeft(repsLeft - 1, stepsTotal),
        };
      } else {
        // Graduate
        const col = this.db.getCol();
        const graduatingIvl = config.new.ints[0];
        return {
          type: CardType.Review,
          queue: CardQueue.Review,
          due: daysSinceCrt(col, now) + graduatingIvl,
          ivl: graduatingIvl,
          reps: card.reps + 1,
          left: 0,
        };
      }
    } else if (ease === RevlogEase.Easy) {
      // Graduate with easy interval
      const col = this.db.getCol();
      const easyIvl = config.new.ints[1];
      return {
        type: CardType.Review,
        queue: CardQueue.Review,
        due: daysSinceCrt(col, now) + easyIvl,
        ivl: easyIvl,
        factor: card.factor + config.rev.ease4,
        reps: card.reps + 1,
        left: 0,
      };
    }

    return {};
  }

  private answerReview(
    card: AnkiCard,
    ease: RevlogEase,
    config: DeckConfig,
    now: number
  ): Partial<AnkiCard> {
    const col = this.db.getCol();

    if (ease === RevlogEase.Again) {
      // Lapse - go to relearning
      // Always apply ease penalty on lapse (clamped to MIN_EASE_FACTOR)
      const newFactor = Math.max(
        MIN_EASE_FACTOR,
        card.factor - 200
      );
      
      return {
        type: CardType.Relearning,
        queue: CardQueue.Learning,
        due: addMinutes(now, config.lapse.delays[0]),
        ivl: Math.max(1, Math.floor(card.ivl * config.lapse.mult)),
        factor: newFactor,
        reps: card.reps + 1,
        lapses: card.lapses + 1,
        left: this.setLeft(config.lapse.delays.length, config.lapse.delays.length),
      };
    } else {
      // Update ease factor
      let newFactor = card.factor;
      
      if (ease === RevlogEase.Hard) {
        newFactor = Math.max(MIN_EASE_FACTOR, card.factor - 150);
      } else if (ease === RevlogEase.Easy) {
        newFactor = card.factor + config.rev.ease4;
      }

      // Calculate new interval
      let newIvl: number;
      const fct = card.factor / 1000;

      if (ease === RevlogEase.Hard) {
        newIvl = Math.ceil(card.ivl * 1.2 * config.rev.ivlFct);
      } else if (ease === RevlogEase.Good) {
        newIvl = Math.ceil(card.ivl * fct * config.rev.ivlFct);
      } else if (ease === RevlogEase.Easy) {
        newIvl = Math.ceil(card.ivl * fct * config.rev.ivlFct * 1.3);
      } else {
        newIvl = card.ivl;
      }

      // Apply fuzz and cap
      newIvl = this.applyFuzz(newIvl, config.rev.fuzz);
      newIvl = Math.min(newIvl, config.rev.maxIvl);
      newIvl = Math.max(newIvl, card.ivl + 1);  // Ensure growth

      return {
        type: CardType.Review,
        queue: CardQueue.Review,
        due: daysSinceCrt(col, now) + newIvl,
        ivl: newIvl,
        factor: newFactor,
        reps: card.reps + 1,
      };
    }
  }

  private answerRelearning(
    card: AnkiCard,
    ease: RevlogEase,
    config: DeckConfig,
    now: number
  ): Partial<AnkiCard> {
    const delays = config.lapse.delays;
    const [repsLeft, stepsTotal] = this.getLeft(card.left);

    if (ease === RevlogEase.Again) {
      // Restart relearning
      return {
        type: CardType.Relearning,
        queue: CardQueue.Learning,
        due: addMinutes(now, delays[0]),
        reps: card.reps + 1,
        left: this.setLeft(stepsTotal, stepsTotal),
      };
    } else {
      const currentStepIndex = stepsTotal - repsLeft;
      
      if (currentStepIndex + 1 < delays.length) {
        // Next relearning step
        return {
          type: CardType.Relearning,
          queue: CardQueue.Learning,
          due: addMinutes(now, delays[currentStepIndex + 1]),
          reps: card.reps + 1,
          left: this.setLeft(repsLeft - 1, stepsTotal),
        };
      } else {
        // Graduate back to review
        const col = this.db.getCol();
        const newIvl = Math.max(config.lapse.minInt, card.ivl);
        
        return {
          type: CardType.Review,
          queue: CardQueue.Review,
          due: daysSinceCrt(col, now) + newIvl,
          ivl: newIvl,
          reps: card.reps + 1,
          left: 0,
        };
      }
    }
  }

  // ==========================================================================
  // UTILITIES
  // ==========================================================================

  /**
   * Encode left field: a*1000+b where a=reps left, b=steps total
   */
  private setLeft(repsLeft: number, stepsTotal: number): number {
    return repsLeft * 1000 + stepsTotal;
  }

  /**
   * Decode left field: returns [repsLeft, stepsTotal]
   */
  private getLeft(left: number): [number, number] {
    const repsLeft = Math.floor(left / 1000);
    const stepsTotal = left % 1000;
    return [repsLeft, stepsTotal];
  }

  /**
   * Apply fuzz to interval (±5%)
   * Uses injected RNG for deterministic testing
   */
  private applyFuzz(ivl: number, fuzzFactor: number): number {
    if (ivl < 2) return ivl;
    
    const fuzz = Math.floor(ivl * fuzzFactor);
    const minIvl = ivl - fuzz;
    const maxIvl = ivl + fuzz;
    
    // Random between min and max (using injected RNG)
    return Math.floor(this.rng() * (maxIvl - minIvl + 1) + minIvl);
  }

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
