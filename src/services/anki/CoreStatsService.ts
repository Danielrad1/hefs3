/**
 * Core Stats Service
 * Handles basic statistics: counts, streaks, daily stats
 * Extracted from bloated StatsService for maintainability
 */

import { InMemoryDb } from './InMemoryDb';
import { AnkiRevlog, AnkiCard } from './schema';
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

export interface GlobalSnapshot {
  date: string;
  // Today's load
  todayDue: number;
  todayLearn: number;
  todayNewLimit: number;
  estTimeP50Sec: number;
  // Today's activity
  reviewsToday: number;
  minutesToday: number;
  // Retention (7/30 day rolling)
  retention7: number;
  retention30: number;
  again7: number;
  again30: number;
  // Backlog pressure
  backlogCount: number;
  backlogMedianDays: number;
  overduenessIndex: number;
  // Streaks
  streak: number;
  bestStreak: number;
  // Adds
  addsToday: number;
  addsWeek: number;
  addsMonth: number;
  // Efficiency
  reviewsPerMin: number;
  avgSecondsPerReview: number;
}

export class CoreStatsService {
  constructor(private db: InMemoryDb) {}

  /**
   * Get all statistics for home screen (optimized)
   */
  getHomeStats(): HomeStats {
    // Get card stats first (fast - already cached in db)
    const dbStats = this.db.getStats();
    const allDecks = this.db.getAllDecks();
    
    // Filter out system decks for accurate count
    const deckCount = allDecks.filter(d => d.name !== 'Default').length;
    
    // Calculate due count using same logic as scheduler
    const col = this.db.getCol();
    const now = nowSeconds();
    const currentDay = Math.floor((now - col.crt) / 86400); // Days since collection creation
    const allCards = this.db.getAllCards();
    
    let dueCount = 0;
    
    // Single pass through cards - exclude suspended/buried
    for (const c of allCards) {
      // Skip suspended (-1) and buried (-2, -3) cards
      if (c.queue < 0) continue;
      
      if (c.type === 0) { // New
        dueCount++;
      } else if (c.type === 1 || c.type === 3) { // Learning/relearning
        if (c.due <= now) dueCount++;
      } else if (c.type === 2) { // Review
        if (c.due <= currentDay) dueCount++;
      }
    }
    
    // Get revlog stats (only process if needed for display)
    const revlog = this.db.getAllRevlog();
    
    const today = this.getTodayString();
    
    // Quick check: if no reviews today, skip expensive calculations
    const hasReviewsToday = revlog.some(r => this.timestampToDateString(parseInt(r.id, 10)) === today);
    
    let dailyStats: DailyStats[];
    let todayStats: DailyStats | undefined;
    let weeklyActivity;
    let currentStreak = 0;
    let longestStreak = 0;
    
    if (hasReviewsToday || revlog.length > 0) {
      dailyStats = this.calculateDailyStats(revlog);
      todayStats = dailyStats.find(s => s.date === today);
      weeklyActivity = this.getWeeklyActivity(dailyStats);
      
      const streaks = this.calculateStreaks(dailyStats);
      currentStreak = streaks.currentStreak;
      longestStreak = streaks.longestStreak;
    } else {
      // No reviews at all - return empty stats quickly
      weeklyActivity = this.getWeeklyActivity([]);
    }
    
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
   * Calculate daily statistics from revlog
   */
  calculateDailyStats(revlog: AnkiRevlog[]): DailyStats[] {
    const dailyMap = new Map<string, {
      reviews: number;
      correct: number;
      totalTime: number;
    }>();
    
    // Group by date string (using local timezone consistently)
    revlog.forEach(entry => {
      const timestampMs = parseInt(entry.id, 10);
      const date = new Date(timestampMs);
      const dateStr = this.dateToString(date);
      
      const existing = dailyMap.get(dateStr) || { reviews: 0, correct: 0, totalTime: 0 };
      
      existing.reviews++;
      if (entry.ease >= 2) {
        existing.correct++;
      }
      existing.totalTime += entry.time;
      
      dailyMap.set(dateStr, existing);
    });
    
    // Convert to sorted array
    const stats: DailyStats[] = [];
    dailyMap.forEach((data, date) => {
      stats.push({
        date,
        reviewCount: data.reviews,
        correctCount: data.correct,
        totalTimeMs: data.totalTime,
        avgTimeMs: data.reviews > 0 ? Math.round(data.totalTime / data.reviews) : 0,
      });
    });
    
    // Sort by date
    stats.sort((a, b) => a.date.localeCompare(b.date));
    
    return stats;
  }

  /**
   * Get weekly activity for the last 7 days
   */
  getWeeklyActivity(dailyStats: DailyStats[]): HomeStats['weeklyActivity'] {
    const today = new Date();
    const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    const activity: HomeStats['weeklyActivity'] = [];
    
    // Create map for quick lookup
    const statsMap = new Map(dailyStats.map(s => [s.date, s]));
    
    // Generate last 7 days
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateStr = this.dateToString(date);
      const dayLabel = dayLabels[date.getDay()];
      const stats = statsMap.get(dateStr);
      
      activity.push({
        dayLabel,
        date: dateStr,
        hasReviews: stats ? stats.reviewCount > 0 : false,
        reviewCount: stats?.reviewCount || 0,
        isToday: i === 0,
        isFuture: false,
      });
    }
    
    return activity;
  }

  /**
   * Calculate current and longest streak
   */
  calculateStreaks(dailyStats: DailyStats[]): { currentStreak: number; longestStreak: number } {
    if (dailyStats.length === 0) {
      return { currentStreak: 0, longestStreak: 0 };
    }
    
    const today = this.getTodayString();
    const datesWithReviews = new Set(
      dailyStats.filter(s => s.reviewCount > 0).map(s => s.date)
    );
    
    // Current streak - count backwards from today
    let currentStreak = 0;
    const currentDate = new Date();
    
    while (true) {
      const dateStr = this.dateToString(currentDate);
      if (dateStr > today) break; // Don't count future
      
      if (datesWithReviews.has(dateStr)) {
        currentStreak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        break;
      }
    }
    
    // Longest streak - scan all dates
    let longestStreak = 0;
    let tempStreak = 0;
    
    if (dailyStats.length > 0) {
      const sortedDates = Array.from(datesWithReviews).sort();
      const allDates = this.generateDateRange(sortedDates[0], today);
      
      for (const date of allDates) {
        if (datesWithReviews.has(date)) {
          tempStreak++;
          longestStreak = Math.max(longestStreak, tempStreak);
        } else {
          tempStreak = 0;
        }
      }
    }
    
    return { currentStreak, longestStreak };
  }

  /**
   * Calculate retention from revlog (percentage of ease >= 2)
   */
  calculateRetention(revlog: AnkiRevlog[], days: number): number {
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - days);
    const windowStartStr = this.dateToString(windowStart);
    
    const windowRevlog = revlog.filter(r => {
      const date = this.timestampToDateString(parseInt(r.id, 10));
      return date >= windowStartStr;
    });
    
    return this.calculateRetentionFromRevlog(windowRevlog);
  }

  calculateRetentionFromRevlog(revlog: AnkiRevlog[]): number {
    if (revlog.length === 0) return 0;
    const goodOrBetter = revlog.filter(r => r.ease >= 2).length;
    return (goodOrBetter / revlog.length) * 100;
  }

  /**
   * Calculate "Again" rate from revlog (percentage of ease === 1)
   */
  calculateAgainRate(revlog: AnkiRevlog[], days: number): number {
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - days);
    const windowStartStr = this.dateToString(windowStart);
    
    const windowRevlog = revlog.filter(r => {
      const date = this.timestampToDateString(parseInt(r.id, 10));
      return date >= windowStartStr;
    });
    
    return this.calculateAgainRateFromRevlog(windowRevlog);
  }

  calculateAgainRateFromRevlog(revlog: AnkiRevlog[]): number {
    if (revlog.length === 0) return 0;
    const againCount = revlog.filter(r => r.ease === 1).length;
    return (againCount / revlog.length) * 100;
  }

  /**
   * Get recent daily average review activity
   */
  getRecentDailyAverage(opts: { days?: number } = {}): {
    avgReviewsPerDay: number;
    avgMinutesPerDay: number;
  } {
    const days = opts.days || 7;
    const revlog = this.db.getAllRevlog();
    
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - days);
    const windowStartStr = this.dateToString(windowStart);
    
    const windowRevlog = revlog.filter(r => {
      const date = this.timestampToDateString(parseInt(r.id, 10));
      return date >= windowStartStr;
    });
    
    const totalTimeMs = windowRevlog.reduce((sum, r) => sum + r.time, 0);
    
    return {
      avgReviewsPerDay: windowRevlog.length / days,
      avgMinutesPerDay: (totalTimeMs / 60000) / days,
    };
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  median(arr: number[]): number {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  generateDateRange(start: string, end: string): string[] {
    const dates: string[] = [];
    const current = new Date(start);
    const endDate = new Date(end);
    
    while (current <= endDate) {
      dates.push(this.dateToString(current));
      current.setDate(current.getDate() + 1);
    }
    
    return dates;
  }

  timestampToDateString(timestampMs: number): string {
    const date = new Date(timestampMs);
    return this.dateToString(date);
  }

  dateToString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  getTodayString(): string {
    return this.dateToString(new Date());
  }

  /**
   * Get card creation date (use note ID as timestamp, fallback to mod)
   */
  getCardCreationDate(c: AnkiCard): Date | null {
    // Try note ID first (typically creation timestamp)
    const nidNum = parseInt(c.nid, 10);
    if (!isNaN(nidNum) && nidNum > 0) {
      return new Date(nidNum);
    }
    // Fallback to card mod (last modified)
    if (c.mod > 0) {
      return new Date(c.mod * 1000); // mod is in seconds
    }
    return null;
  }
}
