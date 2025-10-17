/**
 * Hint Events Repository
 * Tracks hint usage and effectiveness for analytics
 * Phase 4: Hint Intelligence
 */

export interface HintEvent {
  id: string;
  cardId: string;
  deckId: string;
  depth: 1 | 2 | 3; // L1, L2, L3
  timestamp: number; // epoch ms
}

export interface HintReviewLink {
  id: string;
  cardId: string;
  deckId: string; // FIXED: Added deckId for deck-scoped analytics
  hintDepth: number | null; // null if no hint used
  reviewTimestamp: number;
  ease: number; // 1-4
  wasSuccessful: boolean; // ease >= 2
  reviewTime: number; // time taken in milliseconds (from revlog.time)
}

export class HintEventsRepository {
  private hintEvents: HintEvent[] = [];
  private reviewLinks: HintReviewLink[] = [];

  /**
   * Record a hint being revealed
   */
  recordHintRevealed(event: Omit<HintEvent, 'id'>): void {
    this.hintEvents.push({
      id: `hint_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      ...event,
    });
  }

  /**
   * Record a review with optional hint usage
   */
  recordReview(link: Omit<HintReviewLink, 'id'>): void {
    this.reviewLinks.push({
      id: `link_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      ...link,
    });
  }

  /**
   * Get all hint events for a specific deck
   */
  getHintEventsForDeck(deckId: string, sinceTimestamp?: number): HintEvent[] {
    return this.hintEvents.filter(
      (e) => e.deckId === deckId && (!sinceTimestamp || e.timestamp >= sinceTimestamp)
    );
  }

  /**
   * Get all review links for a specific deck
   */
  getReviewLinksForDeck(deckId: string, sinceTimestamp?: number): HintReviewLink[] {
    return this.reviewLinks.filter(
      (r) => r.deckId === deckId && (!sinceTimestamp || r.reviewTimestamp >= sinceTimestamp)
    );
  }

  /**
   * Calculate hint adoption rate (percentage of cards where hint was used)
   */
  getHintAdoptionRate(deckId?: string, days: number = 7): number {
    const since = Date.now() - days * 86400000;
    
    let relevantReviews = this.reviewLinks.filter(r => 
      r.reviewTimestamp >= since && (!deckId || r.deckId === deckId)
    );
    
    if (!relevantReviews.length) return 0;
    
    const hintsUsed = relevantReviews.filter(r => r.hintDepth !== null).length;
    return (hintsUsed / relevantReviews.length) * 100;
  }

  /**
   * Calculate average hint depth used
   */
  getAverageHintDepth(deckId?: string, days: number = 7): number {
    const since = Date.now() - days * 86400000;
    
    const hintsUsed = this.reviewLinks.filter(
      r => r.reviewTimestamp >= since && r.hintDepth !== null && (!deckId || r.deckId === deckId)
    );
    
    if (!hintsUsed.length) return 0;
    
    const totalDepth = hintsUsed.reduce((sum, r) => sum + (r.hintDepth || 0), 0);
    return totalDepth / hintsUsed.length;
  }

  /**
   * Calculate success rate after hint vs without hint
   * Also calculates median time difference (positive = hints save time, negative = hints cost time)
   */
  getHintEffectiveness(deckId?: string, days: number = 7): {
    successWithHint: number;
    successWithoutHint: number;
    timeDelta: number; // seconds saved/lost (median)
  } {
    const since = Date.now() - days * 86400000;
    
    const relevantReviews = this.reviewLinks.filter(r => 
      r.reviewTimestamp >= since && (!deckId || r.deckId === deckId)
    );
    
    const withHint = relevantReviews.filter(r => r.hintDepth !== null);
    const withoutHint = relevantReviews.filter(r => r.hintDepth === null);
    
    const successWithHint = withHint.length > 0
      ? (withHint.filter(r => r.wasSuccessful).length / withHint.length) * 100
      : 0;
    
    const successWithoutHint = withoutHint.length > 0
      ? (withoutHint.filter(r => r.wasSuccessful).length / withoutHint.length) * 100
      : 0;
    
    // Calculate median time delta (median time without hint - median time with hint)
    // Positive value means hints save time, negative means hints cost time
    let timeDelta = 0;
    
    if (withHint.length > 0 && withoutHint.length > 0) {
      const timesWithHint = withHint.map(r => r.reviewTime).sort((a, b) => a - b);
      const timesWithoutHint = withoutHint.map(r => r.reviewTime).sort((a, b) => a - b);
      
      const medianWithHint = this.calculateMedian(timesWithHint);
      const medianWithoutHint = this.calculateMedian(timesWithoutHint);
      
      // Convert to seconds and calculate delta
      timeDelta = (medianWithoutHint - medianWithHint) / 1000;
    }
    
    return {
      successWithHint,
      successWithoutHint,
      timeDelta,
    };
  }

  /**
   * Calculate median from sorted array
   */
  private calculateMedian(sortedValues: number[]): number {
    if (sortedValues.length === 0) return 0;
    
    const mid = Math.floor(sortedValues.length / 2);
    
    if (sortedValues.length % 2 === 0) {
      // Even number of values: average of two middle values
      return (sortedValues[mid - 1] + sortedValues[mid]) / 2;
    } else {
      // Odd number of values: middle value
      return sortedValues[mid];
    }
  }

  /**
   * Get weak concepts (cards with high hint usage and low retention)
   */
  getWeakConcepts(deckId: string, days: number = 30): Array<{
    cardId: string;
    hintUsageRate: number;
    successRate: number;
  }> {
    const since = Date.now() - days * 86400000;
    
    const relevantReviews = this.reviewLinks.filter(r => 
      r.reviewTimestamp >= since && r.deckId === deckId
    );
    
    // Group by card
    const cardStats = new Map<string, { hints: number; total: number; successful: number }>();
    
    relevantReviews.forEach(r => {
      const stats = cardStats.get(r.cardId) || { hints: 0, total: 0, successful: 0 };
      stats.total++;
      if (r.hintDepth !== null) stats.hints++;
      if (r.wasSuccessful) stats.successful++;
      cardStats.set(r.cardId, stats);
    });
    
    // Calculate rates and filter weak concepts
    const weakConcepts: Array<{ cardId: string; hintUsageRate: number; successRate: number }> = [];
    
    cardStats.forEach((stats, cardId) => {
      if (stats.total < 3) return; // Need at least 3 reviews
      
      const hintUsageRate = (stats.hints / stats.total) * 100;
      const successRate = (stats.successful / stats.total) * 100;
      
      // Weak concept: high hint usage (>50%) AND low success (<70%)
      if (hintUsageRate > 50 && successRate < 70) {
        weakConcepts.push({ cardId, hintUsageRate, successRate });
      }
    });
    
    // Sort by hint usage rate descending
    return weakConcepts.sort((a, b) => b.hintUsageRate - a.hintUsageRate);
  }

  /**
   * Clear all data (for testing/reset)
   */
  clear(): void {
    this.hintEvents = [];
    this.reviewLinks = [];
  }
}

// Singleton instance
export const hintEventsRepository = new HintEventsRepository();
