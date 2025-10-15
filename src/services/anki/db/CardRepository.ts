/**
 * Card Repository
 * Handles all CRUD operations for cards
 * Phase 0: Extended with deck-specific analytics queries
 */

import { AnkiCard, AnkiGrave, CardType, CardQueue } from '../schema';
import { nowSeconds } from '../time';

export class CardRepository {
  private cards: Map<string, AnkiCard>;
  private graves: AnkiGrave[];
  private usn: number;

  constructor(cards: Map<string, AnkiCard>, graves: AnkiGrave[], usn: number) {
    this.cards = cards;
    this.graves = graves;
    this.usn = usn;
  }

  get(id: string): AnkiCard | undefined {
    return this.cards.get(id);
  }

  getAll(): AnkiCard[] {
    return Array.from(this.cards.values());
  }

  getByDeck(deckId: string): AnkiCard[] {
    return Array.from(this.cards.values()).filter((c) => c.did === deckId);
  }

  add(card: AnkiCard): void {
    this.cards.set(card.id, card);
  }

  update(id: string, updates: Partial<AnkiCard>): void {
    const card = this.cards.get(id);
    if (!card) {
      throw new Error(`Card ${id} not found`);
    }
    this.cards.set(id, {
      ...card,
      ...updates,
      mod: nowSeconds(),
      usn: this.usn,
    });
  }

  delete(id: string): void {
    this.cards.delete(id);
    this.graves.push({
      usn: this.usn,
      oid: id,
      type: 0, // card
    });
  }

  // ============================================================================
  // PHASE 0: NEW DECK-SPECIFIC QUERY METHODS
  // ============================================================================

  /**
   * Get card counts by deck with state breakdown
   * Returns counts for new, young, mature, suspended, buried, leeches
   */
  getCountsByDeck(deckId: string): {
    new: number;
    young: number; // ivl < 21 days
    mature: number; // ivl >= 21 days
    suspended: number;
    buried: number;
    leeches: number;
    total: number;
  } {
    const cards = this.getByDeck(deckId);
    const MATURE_THRESHOLD = 21;
    const LEECH_THRESHOLD = 8;

    return {
      new: cards.filter((c) => c.type === CardType.New).length,
      young: cards.filter(
        (c) =>
          c.type === CardType.Review &&
          c.ivl > 0 &&
          c.ivl < MATURE_THRESHOLD
      ).length,
      mature: cards.filter(
        (c) => c.type === CardType.Review && c.ivl >= MATURE_THRESHOLD
      ).length,
      suspended: cards.filter((c) => c.queue === CardQueue.Suspended).length,
      buried: cards.filter(
        (c) =>
          c.queue === CardQueue.UserBuried ||
          c.queue === CardQueue.SchedBuried
      ).length,
      leeches: cards.filter((c) => c.lapses >= LEECH_THRESHOLD).length,
      total: cards.length,
    };
  }

  /**
   * Get total lapses for a deck
   */
  getLapsesByDeck(deckId: string): number {
    const cards = this.getByDeck(deckId);
    return cards.reduce((sum, c) => sum + c.lapses, 0);
  }

  /**
   * Get average ease factor for a deck (in permille/10 for easier display)
   */
  getAvgEaseByDeck(deckId: string): number {
    const cards = this.getByDeck(deckId).filter((c) => c.type === CardType.Review);
    if (cards.length === 0) return 250; // Default 2500 permille = 2.5 factor

    const totalEase = cards.reduce((sum, c) => sum + c.factor, 0);
    return totalEase / cards.length / 10; // Convert permille to easier format
  }

  /**
   * Get due cards for today by deck
   * @param deckId Deck ID
   * @param colCrt Collection creation time (seconds)
   */
  getDueTodayByDeck(deckId: string, colCrt: number): number {
    const cards = this.getByDeck(deckId);
    const now = Math.floor(Date.now() / 1000);
    const dayStart = Math.floor(colCrt / 86400);
    const currentDay = Math.floor(now / 86400) - dayStart;

    let dueCount = 0;

    for (const c of cards) {
      if (c.type === CardType.New) {
        dueCount++;
      } else if (
        c.type === CardType.Learning ||
        c.type === CardType.Relearning
      ) {
        if (c.due <= now) dueCount++;
      } else if (c.type === CardType.Review) {
        if (c.due <= currentDay) dueCount++;
      }
    }

    return dueCount;
  }

  /**
   * Get overdue cards for a deck
   * @param deckId Deck ID
   * @param colCrt Collection creation time (seconds)
   */
  getOverdueByDeck(deckId: string, colCrt: number): AnkiCard[] {
    const cards = this.getByDeck(deckId);
    const now = Math.floor(Date.now() / 1000);
    const dayStart = Math.floor(colCrt / 86400);
    const currentDay = Math.floor(now / 86400) - dayStart;

    return cards.filter((c) => {
      if (c.type === CardType.Review && c.due < currentDay) return true;
      if (
        (c.type === CardType.Learning || c.type === CardType.Relearning) &&
        c.due < now
      )
        return true;
      return false;
    });
  }

  /**
   * Get cards by interval range (for interval distribution analysis)
   */
  getByIntervalRange(
    deckId: string,
    minInterval: number,
    maxInterval: number
  ): AnkiCard[] {
    return this.getByDeck(deckId).filter(
      (c) => c.ivl >= minInterval && c.ivl <= maxInterval
    );
  }

  /**
   * Get leeches for a deck (cards with high lapse count)
   */
  getLeechesByDeck(deckId: string, threshold: number = 8): AnkiCard[] {
    return this.getByDeck(deckId).filter((c) => c.lapses >= threshold);
  }

  /**
   * Get cards with low ease factor (struggling cards)
   */
  getLowEaseCards(deckId: string, easeThreshold: number = 2000): AnkiCard[] {
    return this.getByDeck(deckId).filter(
      (c) => c.type === CardType.Review && c.factor <= easeThreshold
    );
  }
}
