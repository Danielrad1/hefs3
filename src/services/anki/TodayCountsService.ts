/**
 * TodayCountsService - Computes Anki-style "Due Today" counts
 * Respects daily limits per deck (new/day, reviews/day)
 */

import { InMemoryDb } from './InMemoryDb';
import { CardType } from './schema';
import { isDue } from './SchedulerV2';
import { todayUsageRepository, TodayUsageRepository } from './db/TodayUsageRepository';

export interface DeckTodayCounts {
  learningDueToday: number;
  reviewDueToday: number;
  newDueToday: number;
  dueTodayTotal: number;
  reviewRemaining: number;
  newRemaining: number;
  reviewDueRaw: number;
  newRaw: number;
}

export interface GlobalTodayCounts {
  dueTodayTotal: number;
  learningTotal: number;
  newTotal: number;
  reviewTotal: number;
}

export class TodayCountsService {
  constructor(
    private db: InMemoryDb,
    private usageRepo: TodayUsageRepository = todayUsageRepository
  ) {}

  /**
   * Get today's counts for a specific deck (Anki-style with daily limits)
   */
  getDeckTodayCounts(deckId: string, now: number = Date.now()): DeckTodayCounts {
    const colConfig = this.db.getColConfig();
    const col = this.db.getCol();
    const dayKey = TodayUsageRepository.getDayKey(colConfig, now);
    const usage = this.usageRepo.getTodayUsage(deckId, dayKey);
    
    // CRITICAL: isDue expects seconds, but now is in milliseconds
    const nowSec = Math.floor(now / 1000);
    
    // Get deck config for daily limits
    const deckConfig = this.db.getDeckConfigForDeck(deckId);
    const newPerDay = deckConfig?.new?.perDay ?? 20;
    const revPerDay = deckConfig?.rev?.perDay ?? 200;
    
    // Get all cards for this deck
    const cards = this.db.getCardsByDeck(deckId);
    
    const deck = this.db.getDeck(deckId);
    console.log(`[TodayCountsService] getDeckTodayCounts for ${deck?.name}:`, {
      deckId,
      cardCount: cards.length,
      usage,
      newPerDay,
      revPerDay,
      dayKey,
      nowSec
    });
    
    let learningDueToday = 0;
    let reviewDueRaw = 0;
    let newRaw = 0;
    
    for (const card of cards) {
      // Skip suspended/buried
      if (card.queue < 0) continue;
      
      const cardIsDue = isDue(card.due, card.type, col, nowSec);
      
      if (card.type === CardType.Learning || card.type === CardType.Relearning) {
        // Learning/Relearning due now (always included, not capped)
        if (cardIsDue) {
          learningDueToday++;
        }
      } else if (card.type === CardType.Review) {
        // Review due today (will be capped by daily limit)
        if (cardIsDue) {
          reviewDueRaw++;
        }
      } else if (card.type === CardType.New) {
        // New cards (will be capped by daily limit)
        newRaw++;
      }
    }
    
    // Calculate remaining capacity for today
    const reviewRemaining = Math.max(0, revPerDay - usage.reviewDone);
    const newRemaining = Math.max(0, newPerDay - usage.newIntroduced);
    
    // Cap counts by remaining daily limit
    const reviewDueToday = Math.min(reviewDueRaw, reviewRemaining);
    const newDueToday = Math.min(newRaw, newRemaining);
    
    const dueTodayTotal = learningDueToday + reviewDueToday + newDueToday;
    
    return {
      learningDueToday,
      reviewDueToday,
      newDueToday,
      dueTodayTotal,
      reviewRemaining,
      newRemaining,
      reviewDueRaw,
      newRaw,
    };
  }

  /**
   * Get global today counts across all decks (or specific deck IDs)
   */
  getGlobalTodayCounts(activeDeckIds?: string[], now: number = Date.now()): GlobalTodayCounts {
    const decks = activeDeckIds 
      ? activeDeckIds.map(id => this.db.getDeck(id)).filter(d => d !== undefined)
      : this.db.getAllDecks().filter(d => d.id !== '1'); // Exclude default deck
    
    console.log('[TodayCountsService] getGlobalTodayCounts - activeDeckIds:', activeDeckIds);
    console.log('[TodayCountsService] decks to process:', decks.map(d => d?.name));
    
    let dueTodayTotal = 0;
    let learningTotal = 0;
    let newTotal = 0;
    let reviewTotal = 0;
    
    for (const deck of decks) {
      if (!deck) continue;
      const counts = this.getDeckTodayCounts(deck.id, now);
      dueTodayTotal += counts.dueTodayTotal;
      learningTotal += counts.learningDueToday;
      newTotal += counts.newDueToday;
      reviewTotal += counts.reviewDueToday;
    }
    
    return {
      dueTodayTotal,
      learningTotal,
      newTotal,
      reviewTotal,
    };
  }

  /**
   * Get remaining capacity for a deck (used by scheduler to gate cards)
   */
  getRemainingCapacity(deckId: string, now: number = Date.now()): {
    canShowReview: boolean;
    canShowNew: boolean;
    reviewRemaining: number;
    newRemaining: number;
  } {
    const counts = this.getDeckTodayCounts(deckId, now);
    return {
      canShowReview: counts.reviewRemaining > 0,
      canShowNew: counts.newRemaining > 0,
      reviewRemaining: counts.reviewRemaining,
      newRemaining: counts.newRemaining,
    };
  }
}
