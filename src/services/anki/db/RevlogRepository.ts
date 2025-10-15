/**
 * Revlog Repository
 * Handles review log operations (review history)
 * Phase 0: Extended with date range and grouping queries
 */

import { AnkiRevlog } from '../schema';

export class RevlogRepository {
  private revlog: AnkiRevlog[];

  constructor(revlog: AnkiRevlog[]) {
    this.revlog = revlog;
  }

  add(entry: AnkiRevlog): void {
    this.revlog.push(entry);
  }

  getForCard(cardId: string): AnkiRevlog[] {
    return this.revlog.filter((r) => r.cid === cardId);
  }

  getAll(): AnkiRevlog[] {
    return [...this.revlog];
  }

  // ============================================================================
  // PHASE 0: NEW QUERY METHODS
  // ============================================================================

  /**
   * Get reviews within a date range (inclusive)
   * @param startDate YYYY-MM-DD format
   * @param endDate YYYY-MM-DD format
   */
  getByDateRange(startDate: string, endDate: string): AnkiRevlog[] {
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime() + 86400000; // Include end date
    
    return this.revlog.filter((r) => {
      const timestamp = parseInt(r.id, 10);
      return timestamp >= start && timestamp < end;
    });
  }

  /**
   * Get reviews for a specific deck within a date range
   * @param deckId Deck ID
   * @param startDate YYYY-MM-DD format
   * @param endDate YYYY-MM-DD format
   * @param getCard Function to get card by ID (injected to avoid circular dependency)
   */
  getByDeckAndDateRange(
    deckId: string,
    startDate: string,
    endDate: string,
    getCard: (cardId: string) => any | undefined
  ): AnkiRevlog[] {
    const rangeRevlog = this.getByDateRange(startDate, endDate);
    return rangeRevlog.filter((r) => {
      const card = getCard(r.cid);
      return card?.did === deckId;
    });
  }

  /**
   * Group reviews by hour of day (0-23)
   * Returns map of hour -> reviews
   */
  groupByHour(): Map<number, AnkiRevlog[]> {
    const grouped = new Map<number, AnkiRevlog[]>();
    
    for (let i = 0; i < 24; i++) {
      grouped.set(i, []);
    }
    
    this.revlog.forEach((r) => {
      const timestamp = parseInt(r.id, 10);
      const date = new Date(timestamp);
      const hour = date.getHours();
      grouped.get(hour)!.push(r);
    });
    
    return grouped;
  }

  /**
   * Group reviews by day of week (0-6, Sunday-Saturday)
   * Returns map of day -> reviews
   */
  groupByDayOfWeek(): Map<number, AnkiRevlog[]> {
    const grouped = new Map<number, AnkiRevlog[]>();
    
    for (let i = 0; i < 7; i++) {
      grouped.set(i, []);
    }
    
    this.revlog.forEach((r) => {
      const timestamp = parseInt(r.id, 10);
      const date = new Date(timestamp);
      const day = date.getDay();
      grouped.get(day)!.push(r);
    });
    
    return grouped;
  }

  /**
   * Get reviews for specific card IDs
   * Useful for filtering by card properties
   */
  getByCardIds(cardIds: Set<string>): AnkiRevlog[] {
    return this.revlog.filter((r) => cardIds.has(r.cid));
  }

  /**
   * Get total time spent reviewing in milliseconds
   * Optionally filtered by date range
   */
  getTotalTime(startDate?: string, endDate?: string): number {
    let reviews = this.revlog;
    
    if (startDate && endDate) {
      reviews = this.getByDateRange(startDate, endDate);
    }
    
    return reviews.reduce((sum, r) => sum + r.time, 0);
  }

  /**
   * Get count of reviews by ease rating
   * Returns { again, hard, good, easy }
   */
  getEaseDistribution(startDate?: string, endDate?: string): {
    again: number;
    hard: number;
    good: number;
    easy: number;
  } {
    let reviews = this.revlog;
    
    if (startDate && endDate) {
      reviews = this.getByDateRange(startDate, endDate);
    }
    
    return {
      again: reviews.filter((r) => r.ease === 1).length,
      hard: reviews.filter((r) => r.ease === 2).length,
      good: reviews.filter((r) => r.ease === 3).length,
      easy: reviews.filter((r) => r.ease === 4).length,
    };
  }
}
