/**
 * Forecast Service
 * Handles workload predictions, simulations, and future card forecasting
 * Extracted from bloated StatsService for maintainability
 */

import { InMemoryDb } from './InMemoryDb';
import { AnkiCard, AnkiRevlog } from './schema';
import { nowSeconds, daysSinceCrt } from './time';
import { CoreStatsService } from './CoreStatsService';

export interface ForecastPoint {
  date: string;
  newCount: number;
  learnCount: number;
  reviewCount: number;
  estMinutesP50: number;
}

export class ForecastService {
  private core: CoreStatsService;

  constructor(private db: InMemoryDb) {
    this.core = new CoreStatsService(db);
  }

  /**
   * Get forecast of upcoming reviews for next N days
   * NOTE: Rough estimation, not production-ready
   */
  getForecast(opts: { days: number; deckId?: string }): ForecastPoint[] {
    const col = this.db.getCol();
    const now = nowSeconds();
    const dayStart = Math.floor(col.crt / 86400);
    const currentDay = Math.floor(now / 86400) - dayStart;
    
    const forecast: ForecastPoint[] = [];
    
    // For each future day, count cards that will be due
    for (let offset = 0; offset < opts.days; offset++) {
      const targetDay = currentDay + offset;
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + offset);
      const dateStr = this.core.dateToString(targetDate);
      
      let newCount = 0;
      let learnCount = 0;
      let reviewCount = 0;
      
      // Handle new cards on day 0 with deck limits
      if (offset === 0) {
        if (opts.deckId) {
          // Deck-specific: cap by deck's perDay limit
          const deckConfig = this.db.getDeckConfigForDeck(opts.deckId);
          const newPerDay = deckConfig?.new?.perDay || 20;
          const allCards = this.db.getCardsByDeck(opts.deckId);
          const newCardsInDeck = allCards.filter(c => c.type === 0).length;
          newCount = Math.min(newCardsInDeck, newPerDay);
        } else {
          // Global: sum capped new cards across all active decks
          const allDecks = this.db.getAllDecks();
          const allDeckConfigs = this.db.getAllDeckConfigs();
          const colConfig = this.db.getColConfig();
          const activeDecks = colConfig?.activeDecks || allDecks.map(d => d.id);
          
          for (const deck of allDecks) {
            if (!activeDecks.includes(deck.id)) continue;
            
            const deckConfig = allDeckConfigs.find(dc => dc.id === deck.conf);
            const newPerDay = deckConfig?.new?.perDay || 20;
            const deckCards = this.db.getCardsByDeck(deck.id);
            const newCardsInDeck = deckCards.filter(c => c.type === 0).length;
            newCount += Math.min(newCardsInDeck, newPerDay);
          }
        }
      }
      
      // Count learning and review cards
      const allCards = opts.deckId 
        ? this.db.getCardsByDeck(opts.deckId)
        : this.db.getAllCards();
      
      for (const c of allCards) {
        if (c.type === 1 || c.type === 3) {
          // Learning: due is epoch seconds, convert to days since crt
          const learnDay = daysSinceCrt(col, c.due);
          if (learnDay === targetDay) learnCount++;
        } else if (c.type === 2) {
          // Review: due is days since crt
          if (c.due === targetDay) reviewCount++;
        }
      }
      
      // Estimate time using 8 sec/card default
      const totalReviews = newCount + learnCount + reviewCount;
      const estMinutesP50 = (totalReviews * 8) / 60;
      
      forecast.push({
        date: dateStr,
        newCount,
        learnCount,
        reviewCount,
        estMinutesP50,
      });
    }
    
    return forecast;
  }

  /**
   * Simulate workload with different new card settings
   * Simple exponential model for forecasting
   */
  simulateWorkload(newPerDay: number, targetDays: number): {
    days: number;
    avgDailyReviews: number;
    avgDailyMinutes: number;
    peakDay: number;
    peakReviews: number;
  } {
    const allCards = this.db.getAllCards();
    const revlog = this.db.getAllRevlog();
    
    // Calculate average retention from last 30 days
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - 30);
    const windowStartStr = this.core.dateToString(windowStart);
    
    const recentRevlog = revlog.filter(r => {
      const date = this.core.timestampToDateString(parseInt(r.id, 10));
      return date >= windowStartStr;
    });
    
    const retention = recentRevlog.length > 0
      ? recentRevlog.filter(r => r.ease >= 2).length / recentRevlog.length
      : 0.85; // Default 85% retention
    
    // Average time per review from recent data
    const avgTimePerReview = recentRevlog.length > 0
      ? recentRevlog.reduce((sum, r) => sum + r.time, 0) / recentRevlog.length / 1000
      : 8; // Default 8 seconds
    
    // Simple simulation: each day adds newPerDay cards
    // Cards generate reviews based on exponential intervals
    const dailyReviews: number[] = [];
    let peakReviews = 0;
    let peakDay = 0;
    
    for (let day = 0; day < targetDays; day++) {
      let reviewsToday = 0;
      
      // New cards added on this day will generate reviews
      // Day 1: newPerDay reviews
      // Day 2-7: learning reviews (2-3x)
      // Day 8+: graduated reviews (decreasing exponentially)
      
      for (let addDay = 0; addDay <= day; addDay++) {
        const daysSinceAdded = day - addDay;
        
        if (daysSinceAdded === 0) {
          reviewsToday += newPerDay; // Initial learning
        } else if (daysSinceAdded < 7) {
          reviewsToday += newPerDay * 0.5; // Learning phase
        } else {
          // Exponential decay with retention
          const interval = Math.pow(2, Math.floor(daysSinceAdded / 7));
          if (daysSinceAdded % interval === 0) {
            reviewsToday += newPerDay * retention;
          }
        }
      }
      
      dailyReviews.push(reviewsToday);
      if (reviewsToday > peakReviews) {
        peakReviews = reviewsToday;
        peakDay = day + 1;
      }
    }
    
    const avgDailyReviews = dailyReviews.reduce((sum, r) => sum + r, 0) / targetDays;
    const avgDailyMinutes = (avgDailyReviews * avgTimePerReview) / 60;
    
    return {
      days: targetDays,
      avgDailyReviews,
      avgDailyMinutes,
      peakDay,
      peakReviews: Math.round(peakReviews),
    };
  }

  /**
   * Get timeline of cards added over time
   */
  getAddsTimeline(opts: { days?: number } = {}): Array<{ date: string; count: number }> {
    const days = opts.days || 30;
    const allCards = this.db.getAllCards();
    
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = this.core.dateToString(since);
    
    // Group cards by creation date
    const dateMap = new Map<string, number>();
    
    for (const c of allCards) {
      const creationDate = this.core.getCardCreationDate(c);
      if (!creationDate) continue;
      
      const dateStr = this.core.dateToString(creationDate);
      if (dateStr >= sinceStr) {
        dateMap.set(dateStr, (dateMap.get(dateStr) || 0) + 1);
      }
    }
    
    // Generate all dates in range with zero-fill
    const result: Array<{ date: string; count: number }> = [];
    const today = new Date();
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateStr = this.core.dateToString(date);
      
      result.push({
        date: dateStr,
        count: dateMap.get(dateStr) || 0,
      });
    }
    
    return result;
  }
}
