/**
 * Stats Repository
 * Provides statistics and aggregations across the database
 */

import { AnkiCard } from '../schema';

export class StatsRepository {
  private cards: Map<string, AnkiCard>;

  constructor(cards: Map<string, AnkiCard>) {
    this.cards = cards;
  }

  getStats(deckId?: string): {
    newCount: number;
    learningCount: number;
    reviewCount: number;
    totalCards: number;
  } {
    const cards = deckId
      ? Array.from(this.cards.values()).filter((c) => c.did === deckId)
      : Array.from(this.cards.values());

    // Filter out suspended and buried cards
    const activeCards = cards.filter(
      (c) =>
        c.queue !== -1 && // Suspended
        c.queue !== -2 && // User buried
        c.queue !== -3 // Sched buried
    );

    const newCount = activeCards.filter((c) => c.type === 0).length;
    const learningCount = activeCards.filter((c) => c.type === 1 || c.type === 3).length;
    const reviewCount = activeCards.filter((c) => c.type === 2).length;

    return {
      newCount,
      learningCount,
      reviewCount,
      totalCards: cards.length, // Total includes suspended
    };
  }
}
