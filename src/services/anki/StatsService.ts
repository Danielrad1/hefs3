/**
 * Statistics Service
 * Calculates real statistics from revlog and card data
 */

import { InMemoryDb } from './InMemoryDb';
import { AnkiRevlog } from './schema';
import { nowSeconds } from './time';

export interface DailyStats {
  date: string; // YYYY-MM-DD
  reviewCount: number;
  correctCount: number; // ease >= 2
  totalTimeMs: number;
  avgTimeMs: number;
}

export interface HomeStats {
  // Today's stats
  todayReviewCount: number;
  todayCorrectCount: number;
  todayAccuracy: number; // percentage
  todayTimeMinutes: number;
  
  // Current streak (consecutive days with reviews)
  currentStreak: number;
  longestStreak: number;
  
  // Weekly activity (last 7 days)
  weeklyActivity: Array<{
    dayLabel: string; // M, T, W, etc.
    date: string; // YYYY-MM-DD
    hasReviews: boolean;
    reviewCount: number;
    isToday: boolean;
    isFuture: boolean;
  }>;
  
  // All-time stats
  totalReviewsAllTime: number;
  totalCardsCount: number;
  totalDecksCount: number;
  dueCount: number;
  
  // Card breakdown
  newCount: number;
  learningCount: number;
  reviewCount: number;
}

export class StatsService {
  constructor(private db: InMemoryDb) {}

  /**
   * Get all statistics for home screen (optimized)
   */
  getHomeStats(): HomeStats {
    const startTime = Date.now();
    console.log('[StatsService] getHomeStats START');
    
    // Get card stats first (fast - already cached in db)
    const t1 = Date.now();
    const dbStats = this.db.getStats();
    const allDecks = this.db.getAllDecks();
    const deckCount = allDecks.filter(d => d.id !== '1').length; // Exclude Default deck
    console.log(`[StatsService] Got deck stats in ${Date.now() - t1}ms`);
    
    // Calculate due count (optimized - single pass)
    const t2 = Date.now();
    const col = this.db.getCol();
    const now = Math.floor(Date.now() / 1000);
    const dayStart = Math.floor(col.crt / 86400);
    const currentDay = Math.floor(now / 86400) - dayStart;
    
    const allCards = this.db.getAllCards();
    console.log(`[StatsService] Got ${allCards.length} cards in ${Date.now() - t2}ms`);
    
    const t3 = Date.now();
    let dueCount = 0;
    
    // Single pass through cards
    for (const c of allCards) {
      if (c.type === 0) { // New
        dueCount++;
      } else if (c.type === 1 || c.type === 3) { // Learning/relearning
        if (c.due <= now) dueCount++;
      } else if (c.type === 2) { // Review
        if (c.due <= currentDay) dueCount++;
      }
    }
    console.log(`[StatsService] Calculated due count (${dueCount}) in ${Date.now() - t3}ms`);
    
    // Get revlog stats (only process if needed for display)
    const t4 = Date.now();
    const revlog = this.db.getAllRevlog();
    console.log(`[StatsService] Got ${revlog.length} revlog entries in ${Date.now() - t4}ms`);
    
    const today = this.getTodayString();
    
    // Quick check: if no reviews today, skip expensive calculations
    const t5 = Date.now();
    const hasReviewsToday = revlog.some(r => this.timestampToDateString(parseInt(r.id, 10)) === today);
    console.log(`[StatsService] Checked for today's reviews in ${Date.now() - t5}ms, hasReviewsToday: ${hasReviewsToday}`);
    
    let dailyStats: DailyStats[];
    let todayStats: DailyStats | undefined;
    let weeklyActivity;
    let currentStreak = 0;
    let longestStreak = 0;
    
    const t6 = Date.now();
    if (hasReviewsToday || revlog.length > 0) {
      console.log('[StatsService] Processing revlog...');
      
      const t6a = Date.now();
      dailyStats = this.calculateDailyStats(revlog);
      console.log(`[StatsService] calculateDailyStats took ${Date.now() - t6a}ms`);
      
      const t6b = Date.now();
      todayStats = dailyStats.find(s => s.date === today);
      console.log(`[StatsService] find todayStats took ${Date.now() - t6b}ms`);
      
      const t6c = Date.now();
      weeklyActivity = this.getWeeklyActivity(dailyStats);
      console.log(`[StatsService] getWeeklyActivity took ${Date.now() - t6c}ms`);
      
      const t6d = Date.now();
      const streaks = this.calculateStreaks(dailyStats);
      currentStreak = streaks.currentStreak;
      longestStreak = streaks.longestStreak;
      console.log(`[StatsService] calculateStreaks took ${Date.now() - t6d}ms`);
      
      console.log(`[StatsService] Processed revlog in ${Date.now() - t6}ms`);
    } else {
      // No reviews at all - return empty stats quickly
      weeklyActivity = this.getWeeklyActivity([]);
      console.log(`[StatsService] No reviews, skipped processing in ${Date.now() - t6}ms`);
    }
    
    console.log(`[StatsService] getHomeStats COMPLETE in ${Date.now() - startTime}ms`);
    
    return {
      todayReviewCount: todayStats?.reviewCount || 0,
      todayCorrectCount: todayStats?.correctCount || 0,
      todayAccuracy: todayStats 
        ? todayStats.reviewCount > 0 
          ? Math.round((todayStats.correctCount / todayStats.reviewCount) * 100)
          : 0
        : 0,
      todayTimeMinutes: todayStats 
        ? Math.round(todayStats.totalTimeMs / 60000)
        : 0,
      currentStreak,
      longestStreak,
      weeklyActivity,
      totalReviewsAllTime: revlog.length,
      totalCardsCount: dbStats.totalCards,
      totalDecksCount: deckCount,
      dueCount,
      newCount: dbStats.newCount,
      learningCount: dbStats.learningCount,
      reviewCount: dbStats.reviewCount,
    };
  }

  /**
   * Calculate daily statistics from revlog - FIXED to use local timezone
   */
  private calculateDailyStats(revlog: AnkiRevlog[]): DailyStats[] {
    const dailyMap = new Map<string, {
      reviews: number;
      correct: number;
      totalTime: number;
    }>();
    
    // Group by date string (using local timezone consistently)
    revlog.forEach(entry => {
      const timestampMs = parseInt(entry.id, 10);
      const date = new Date(timestampMs);
      const dateStr = this.dateToString(date); // Use local timezone
      
      const existing = dailyMap.get(dateStr) || { reviews: 0, correct: 0, totalTime: 0 };
      
      existing.reviews++;
      if (entry.ease >= 2) { // Good or better
        existing.correct++;
      }
      existing.totalTime += entry.time;
      
      dailyMap.set(dateStr, existing);
    });
    
    // Convert to array and sort
    return Array.from(dailyMap.entries())
      .map(([dateStr, stats]) => ({
        date: dateStr,
        reviewCount: stats.reviews,
        correctCount: stats.correct,
        totalTimeMs: stats.totalTime,
        avgTimeMs: stats.totalTime / stats.reviews,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Get weekly activity for the last 7 days
   */
  private getWeeklyActivity(dailyStats: DailyStats[]): HomeStats['weeklyActivity'] {
    const today = new Date();
    const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    const activity: HomeStats['weeklyActivity'] = [];
    
    // Generate last 7 days
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = this.dateToString(date);
      const dayOfWeek = date.getDay();
      const isToday = i === 0;
      const isFuture = false; // All dates are in the past or today
      
      const dayStats = dailyStats.find(s => s.date === dateStr);
      
      activity.push({
        dayLabel: dayLabels[dayOfWeek],
        date: dateStr,
        hasReviews: !!dayStats && dayStats.reviewCount > 0,
        reviewCount: dayStats?.reviewCount || 0,
        isToday,
        isFuture,
      });
    }
    
    return activity;
  }

  /**
   * Calculate current and longest streak (optimized - fixed logic)
   */
  private calculateStreaks(dailyStats: DailyStats[]): { currentStreak: number; longestStreak: number } {
    if (dailyStats.length === 0) {
      return { currentStreak: 0, longestStreak: 0 };
    }
    
    // Create a map of dates with reviews for fast lookup
    const datesWithReviews = new Set(
      dailyStats.filter(s => s.reviewCount > 0).map(s => s.date)
    );
    
    if (datesWithReviews.size === 0) {
      return { currentStreak: 0, longestStreak: 0 };
    }
    
    const today = this.getTodayString();
    
    // Calculate current streak (consecutive days with reviews)
    // Streak logic: consecutive days you've studied, including today if you studied today
    let currentStreak = 0;
    const todayMs = new Date(today).getTime();
    
    // Check if user studied today or yesterday (grace period)
    const hasStudiedToday = datesWithReviews.has(today);
    const yesterday = new Date(todayMs - 86400000);
    const yesterdayStr = this.dateToString(yesterday);
    const hasStudiedYesterday = datesWithReviews.has(yesterdayStr);
    
    console.log('[StatsService] Streak calculation:', {
      today,
      hasStudiedToday,
      yesterdayStr,
      hasStudiedYesterday,
      datesWithReviews: Array.from(datesWithReviews).slice(0, 10), // First 10 dates
      totalDatesWithReviews: datesWithReviews.size,
    });
    
    // If no activity today or yesterday, streak is broken
    if (!hasStudiedToday && !hasStudiedYesterday) {
      currentStreak = 0;
      console.log('[StatsService] Streak broken - no activity today or yesterday');
    } else {
      // Count backwards from today to find consecutive days
      let startDay = hasStudiedToday ? 0 : 1; // Start from today if studied today, else yesterday
      
      for (let i = startDay; i < 365; i++) { // Max 1 year lookback
        const checkDate = new Date(todayMs - i * 86400000);
        const dateStr = this.dateToString(checkDate);
        
        if (datesWithReviews.has(dateStr)) {
          currentStreak++;
        } else {
          // Gap found, stop counting
          console.log('[StatsService] Streak stopped at day', i, 'date:', dateStr);
          break;
        }
      }
      console.log('[StatsService] Final current streak:', currentStreak);
    }
    
    // Calculate longest streak
    const sortedDates = Array.from(datesWithReviews).sort();
    let longestStreak = 1;
    let tempStreak = 1;
    
    for (let i = 1; i < sortedDates.length; i++) {
      const prevDate = new Date(sortedDates[i - 1]);
      const currDate = new Date(sortedDates[i]);
      const dayDiff = Math.floor((currDate.getTime() - prevDate.getTime()) / 86400000);
      
      if (dayDiff === 1) {
        // Consecutive day
        tempStreak++;
        longestStreak = Math.max(longestStreak, tempStreak);
      } else {
        // Gap found, reset
        tempStreak = 1;
      }
    }
    
    return { currentStreak, longestStreak };
  }

  /**
   * Generate array of date strings between start and end (inclusive)
   */
  private generateDateRange(start: string, end: string): string[] {
    const dates: string[] = [];
    const current = new Date(start);
    const endDate = new Date(end);
    
    while (current <= endDate) {
      dates.push(this.dateToString(current));
      current.setDate(current.getDate() + 1);
    }
    
    return dates;
  }

  /**
   * Convert timestamp (ms) to YYYY-MM-DD string
   */
  private timestampToDateString(timestampMs: number): string {
    const date = new Date(timestampMs);
    return this.dateToString(date);
  }

  /**
   * Convert Date to YYYY-MM-DD string
   */
  private dateToString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Get today's date as YYYY-MM-DD string
   */
  private getTodayString(): string {
    return this.dateToString(new Date());
  }
}
