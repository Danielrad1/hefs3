/**
 * TodayUsageRepository - Tracks daily card usage (new introduced, reviews done)
 * Enables Anki-style daily limits and carryover behavior
 */

import { ColConfig } from '../schema';

export interface DayUsage {
  newIntroduced: number;
  reviewDone: number;
}

export interface TodayUsageData {
  // Map: "deckId:dayKey" -> DayUsage
  [key: string]: DayUsage;
}

export class TodayUsageRepository {
  private data: TodayUsageData = {};

  /**
   * Compute day key based on collection config and rollover hour
   * Returns ISO date string at rollover boundary
   */
  static getDayKey(colConfig: ColConfig, now: number = Date.now()): string {
    const rolloverHour = colConfig.rollover ?? 4;
    const nowDate = new Date(now);
    
    // Adjust for rollover: if before rollover hour, count as previous day
    const effectiveDate = new Date(now);
    if (nowDate.getHours() < rolloverHour) {
      effectiveDate.setDate(effectiveDate.getDate() - 1);
    }
    
    // Return ISO date string (YYYY-MM-DD) at rollover boundary
    effectiveDate.setHours(rolloverHour, 0, 0, 0);
    return effectiveDate.toISOString().split('T')[0];
  }

  private getKey(deckId: string, dayKey: string): string {
    return `${deckId}:${dayKey}`;
  }

  /**
   * Get today's usage for a deck
   */
  getTodayUsage(deckId: string, dayKey: string): DayUsage {
    const key = this.getKey(deckId, dayKey);
    return this.data[key] || { newIntroduced: 0, reviewDone: 0 };
  }

  /**
   * Increment new cards introduced today
   */
  incrementNewIntroduced(deckId: string, dayKey: string): void {
    const key = this.getKey(deckId, dayKey);
    if (!this.data[key]) {
      this.data[key] = { newIntroduced: 0, reviewDone: 0 };
    }
    this.data[key].newIntroduced++;
  }

  /**
   * Increment reviews done today
   */
  incrementReviewDone(deckId: string, dayKey: string): void {
    const key = this.getKey(deckId, dayKey);
    if (!this.data[key]) {
      this.data[key] = { newIntroduced: 0, reviewDone: 0 };
    }
    this.data[key].reviewDone++;
  }

  /**
   * Clear old day data (optional cleanup)
   */
  clearOldDays(currentDayKey: string): void {
    const keysToDelete: string[] = [];
    for (const key in this.data) {
      const dayKey = key.split(':')[1];
      if (dayKey < currentDayKey) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => delete this.data[key]);
  }

  /**
   * Export data for persistence
   */
  toJSON(): TodayUsageData {
    return { ...this.data };
  }

  /**
   * Import data from persistence
   */
  fromJSON(data: TodayUsageData): void {
    this.data = data || {};
  }

  /**
   * Reset all data (for testing)
   */
  reset(): void {
    this.data = {};
  }
}

// Singleton instance
export const todayUsageRepository = new TodayUsageRepository();
