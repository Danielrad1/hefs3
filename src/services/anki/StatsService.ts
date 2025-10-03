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
   * Get all statistics for home screen
   */
  getHomeStats(): HomeStats {
    const revlog = this.db.getAllRevlog();
    const dailyStats = this.calculateDailyStats(revlog);
    const today = this.getTodayString();
    const todayStats = dailyStats.find(s => s.date === today);
    
    const weeklyActivity = this.getWeeklyActivity(dailyStats);
    const { currentStreak, longestStreak } = this.calculateStreaks(dailyStats);
    
    // Get card stats
    const dbStats = this.db.getStats();
    const allDecks = this.db.getAllDecks().filter(d => d.id !== '1'); // Exclude Default deck
    
    // Calculate due count
    const col = this.db.getCol();
    const now = Math.floor(Date.now() / 1000);
    const allCards = this.db.getAllCards();
    const dueCards = allCards.filter(c => {
      if (c.type === 0) return true; // New cards are "due"
      if (c.type === 1 || c.type === 3) {
        // Learning/relearning - due is timestamp
        return c.due <= now;
      }
      if (c.type === 2) {
        // Review - due is day number
        const dayStart = Math.floor(col.crt / 86400);
        const currentDay = Math.floor(now / 86400) - dayStart;
        return c.due <= currentDay;
      }
      return false;
    });
    
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
      totalDecksCount: allDecks.length,
      dueCount: dueCards.length,
      newCount: dbStats.newCount,
      learningCount: dbStats.learningCount,
      reviewCount: dbStats.reviewCount,
    };
  }

  /**
   * Calculate daily statistics from revlog
   */
  private calculateDailyStats(revlog: AnkiRevlog[]): DailyStats[] {
    const dailyMap = new Map<string, {
      reviews: number;
      correct: number;
      totalTime: number;
    }>();
    
    revlog.forEach(entry => {
      const date = this.timestampToDateString(parseInt(entry.id, 10));
      const existing = dailyMap.get(date) || { reviews: 0, correct: 0, totalTime: 0 };
      
      existing.reviews++;
      if (entry.ease >= 2) { // Good or better
        existing.correct++;
      }
      existing.totalTime += entry.time;
      
      dailyMap.set(date, existing);
    });
    
    return Array.from(dailyMap.entries())
      .map(([date, stats]) => ({
        date,
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
   * Calculate current and longest streak
   */
  private calculateStreaks(dailyStats: DailyStats[]): { currentStreak: number; longestStreak: number } {
    if (dailyStats.length === 0) {
      return { currentStreak: 0, longestStreak: 0 };
    }
    
    // Sort by date descending
    const sorted = [...dailyStats].sort((a, b) => b.date.localeCompare(a.date));
    
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    
    const today = this.getTodayString();
    let checkDate = today;
    
    // Calculate current streak (consecutive days up to today)
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].date === checkDate && sorted[i].reviewCount > 0) {
        currentStreak++;
        // Move to previous day
        const date = new Date(checkDate);
        date.setDate(date.getDate() - 1);
        checkDate = this.dateToString(date);
      } else {
        break;
      }
    }
    
    // Calculate longest streak
    const allDates = this.generateDateRange(sorted[sorted.length - 1].date, sorted[0].date);
    const statsMap = new Map(sorted.map(s => [s.date, s]));
    
    for (const date of allDates) {
      const stats = statsMap.get(date);
      if (stats && stats.reviewCount > 0) {
        tempStreak++;
        longestStreak = Math.max(longestStreak, tempStreak);
      } else {
        tempStreak = 0;
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
