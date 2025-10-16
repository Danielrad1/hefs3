/**
 * Statistics Service
 * Calculates real statistics from revlog and card data
 * Phase 0: Comprehensive stats foundation for premium analytics
 */

import { InMemoryDb } from './InMemoryDb';
import { AnkiRevlog, AnkiCard, CardType } from './schema';
import { nowSeconds, isDue, daysSinceCrt } from './time'; // FIXED: Import isDue and daysSinceCrt
import { hintEventsRepository } from './db/HintEventsRepository';

// ============================================================================
// LEGACY TYPES (maintain compatibility)
// ============================================================================

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

// ============================================================================
// PHASE 0: NEW COMPREHENSIVE STATS TYPES
// ============================================================================

/** Global snapshot (Home screen free tier) */
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

/** Deck-specific snapshot (Deck detail free tier) */
export interface DeckSnapshot {
  deckId: string;
  deckName: string;
  // Counts
  counts: {
    new: number;
    young: number;  // ivl < 21 days
    mature: number; // ivl >= 21 days
    suspended: number;
    buried: number;
    leeches: number;
    total: number;
  };
  // Today's load
  today: {
    due: number;
    learn: number;
    estTimeP50Sec: number;
  };
  // Retention (7/30 day)
  retention: {
    young7: number;
    mature7: number;
    young30: number;
    mature30: number;
  };
  // Throughput
  throughput: {
    rpm: number; // reviews per minute
    secPerReview: number;
  };
  // Difficulty metrics
  difficultyIndex: number; // 0-100 composite score
  avgEase: number;
  lapsesPer100: number;
}

/** Forecast point for time-series prediction */
export interface ForecastPoint {
  date: string;
  newCount: number;
  learnCount: number;
  reviewCount: number;
  estMinutesP50: number;
}

/** Best hours analysis (Premium) */
export interface BestHoursData {
  hour: number; // 0-23
  retentionPct: number;
  secPerReview: number;
  reviewCount: number;
}

/** Hint effectiveness stats (Premium) */
export interface HintStats {
  adoptionPct: number;
  avgDepth: number; // 1-3
  successAfterHintPct: number;
  successWithoutHintPct: number; // FIXED: Added real success rate without hints
  secDeltaAfterHint: number;
  weakTags: Array<{
    tag: string;
    againRate: number;
    hintUsePct: number;
  }>;
}

/** Weekly coach report data (Phase 5) */
export interface WeeklyCoachReport {
  weekStart: string;
  weekEnd: string;
  insights: Array<{
    type: 'success' | 'warning' | 'info' | 'action';
    title: string;
    message: string;
    actionText?: string;
  }>;
  summary: {
    totalReviews: number;
    avgAccuracy: number;
    streakDays: number;
    cardsAdded: number;
  };
}

export class StatsService {
  constructor(private db: InMemoryDb) {}

  /**
   * Get all statistics for home screen (optimized)
   */
  getHomeStats(): HomeStats {
    // Get card stats first (fast - already cached in db)
    const dbStats = this.db.getStats();
    const allDecks = this.db.getAllDecks();
    const deckCount = allDecks.filter(d => d.id !== '1').length; // Exclude Default deck
    
    // Calculate due count (optimized - single pass)
    const col = this.db.getCol();
    const now = Math.floor(Date.now() / 1000);
    const dayStart = Math.floor(col.crt / 86400);
    const currentDay = Math.floor(now / 86400) - dayStart;
    
    const allCards = this.db.getAllCards();
    
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
   * Get card creation date (use note ID as timestamp, fallback to mod)
   */
  private getCardCreationDate(c: AnkiCard): Date | null {
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
    const now = new Date();
    const todayMs = now.getTime();
    
    // Check if user studied today or yesterday (grace period)
    const hasStudiedToday = datesWithReviews.has(today);
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = this.dateToString(yesterday);
    const hasStudiedYesterday = datesWithReviews.has(yesterdayStr);
    
    // If no activity today or yesterday, streak is broken
    if (!hasStudiedToday && !hasStudiedYesterday) {
      currentStreak = 0;
    } else {
      // Count backwards from today to find consecutive days
      let startDay = hasStudiedToday ? 0 : 1; // Start from today if studied today, else yesterday
      
      for (let i = startDay; i < 365; i++) {
        const date = new Date(todayMs - i * 86400000);
        const dateStr = this.dateToString(date);
        
        if (datesWithReviews.has(dateStr)) {
          currentStreak++;
        } else {
          // Gap found, stop counting
          break;
        }
      }
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

  // ============================================================================
  // PHASE 0: NEW COMPREHENSIVE STATS METHODS
  // ============================================================================

  /**
   * Get global snapshot with comprehensive home stats
   * Free tier method with all basic analytics
   */
  getGlobalSnapshot(opts: { windowDays: 7 | 30 } = { windowDays: 7 }): GlobalSnapshot {
    const today = this.getTodayString();
    const revlog = this.db.getAllRevlog();
    const allCards = this.db.getAllCards();
    const col = this.db.getCol();
    
    // Calculate due counts (FIXED: respect deck limits for new cards)
    const now = Math.floor(Date.now() / 1000);
    const dayStart = Math.floor(col.crt / 86400);
    const currentDay = Math.floor(now / 86400) - dayStart;
    const allDecks = this.db.getAllDecks();
    const allDeckConfigs = this.db.getAllDeckConfigs();
    const colConfig = this.db.getColConfig();
    const activeDecks = colConfig?.activeDecks || allDecks.map(d => d.id);
    
    let dueCount = 0;
    let learnCount = 0;
    
    // Count new cards per deck (respecting perDay limits)
    for (const deck of allDecks) {
      if (!activeDecks.includes(deck.id)) continue; // Skip inactive decks
      
      const deckConfig = allDeckConfigs.find(dc => dc.id === deck.conf);
      const newPerDay = deckConfig?.new?.perDay || 20; // Default 20
      
      const newCardsInDeck = allCards.filter(c => c.did === deck.id && c.type === 0);
      const availableNew = Math.min(newCardsInDeck.length, newPerDay);
      dueCount += availableNew;
    }
    
    // Add learning and review cards that are actually due (FIXED: use isDue)
    for (const c of allCards) {
      if (!isDue(c.due, c.type, col, now)) continue; // Skip not due
      
      if (c.type === 1 || c.type === 3) { // Learning/relearning
        dueCount++;
        learnCount++;
      } else if (c.type === 2) { // Review
        dueCount++;
      }
    }
    
    // Filter revlog by window
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - opts.windowDays);
    const windowStartStr = this.dateToString(windowStart);
    
    const windowRevlog = revlog.filter(r => {
      const date = this.timestampToDateString(parseInt(r.id, 10));
      return date >= windowStartStr;
    });
    
    // Calculate retention and again rate
    const totalReviews = windowRevlog.length;
    const againCount = windowRevlog.filter(r => r.ease === 1).length;
    const goodOrBetter = totalReviews - againCount;
    
    const retention = totalReviews > 0 ? (goodOrBetter / totalReviews) * 100 : 0;
    const againRate = totalReviews > 0 ? (againCount / totalReviews) * 100 : 0;
    
    // Today's reviews
    const todayRevlog = revlog.filter(r => 
      this.timestampToDateString(parseInt(r.id, 10)) === today
    );
    const todayTimeMs = todayRevlog.reduce((sum, r) => sum + r.time, 0);
    
    // Calculate backlog (overdue cards)
    const overdue = allCards.filter(c => {
      if (c.type === 2 && c.due < currentDay) return true; // Review cards
      if ((c.type === 1 || c.type === 3) && c.due < now) return true; // Learn cards
      return false;
    });
    
    const overdueDays = overdue.map(c => {
      if (c.type === 2) return currentDay - c.due;
      return Math.floor((now - c.due) / 86400);
    }).filter(d => d > 0);
    
    const medianOverdue = overdueDays.length > 0 
      ? this.median(overdueDays) 
      : 0;
    
    // Overdueness index (capped sum of days overdue)
    const overduenessIndex = overdueDays.reduce((sum, days) => 
      sum + Math.min(days, 30), 0
    ) / Math.max(allCards.length, 1);
    
    // Streaks
    const dailyStats = this.calculateDailyStats(revlog);
    const streaks = this.calculateStreaks(dailyStats);
    
    // Adds over time (FIXED: use note ID as creation timestamp, fallback to mod)
    const addsToday = allCards.filter(c => {
      const cardDate = this.getCardCreationDate(c);
      return cardDate !== null && this.dateToString(cardDate) === today;
    }).length;
    
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = this.dateToString(weekAgo);
    const addsWeek = allCards.filter(c => {
      const cardDate = this.getCardCreationDate(c);
      return cardDate !== null && this.dateToString(cardDate) >= weekAgoStr;
    }).length;
    
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);
    const monthAgoStr = this.dateToString(monthAgo);
    const addsMonth = allCards.filter(c => {
      const cardDate = this.getCardCreationDate(c);
      return cardDate !== null && this.dateToString(cardDate) >= monthAgoStr;
    }).length;
    
    // Efficiency metrics (today's throughput)
    const todayReviewCount = todayRevlog.length;
    const reviewsPerMin = todayReviewCount > 0 && todayTimeMs > 0
      ? (todayReviewCount / (todayTimeMs / 60000))
      : 0;
    
    const avgSecondsPerReview = todayReviewCount > 0
      ? (todayTimeMs / 1000) / todayReviewCount
      : 0;
    
    // Estimate time (p50 from recent reviews)
    const recentTimes = windowRevlog.map(r => r.time / 1000).sort((a, b) => a - b);
    const estTimeP50Sec = recentTimes.length > 0 
      ? recentTimes[Math.floor(recentTimes.length * 0.5)] * dueCount
      : dueCount * 8; // Default 8 sec/card
    
    // Calculate total new card limit (FIXED: sum active decks' limits)
    let totalNewLimit = 0;
    for (const deck of allDecks) {
      if (!activeDecks.includes(deck.id)) continue;
      const deckConfig = allDeckConfigs.find(dc => dc.id === deck.conf);
      totalNewLimit += deckConfig?.new?.perDay || 20;
    }
    
    return {
      date: today,
      todayDue: dueCount,
      todayLearn: learnCount,
      todayNewLimit: totalNewLimit, // FIXED: Actual sum from deck configs
      estTimeP50Sec,
      reviewsToday: todayRevlog.length,
      minutesToday: Math.round(todayTimeMs / 60000),
      retention7: opts.windowDays === 7 ? retention : this.calculateRetention(revlog, 7),
      retention30: opts.windowDays === 30 ? retention : this.calculateRetention(revlog, 30),
      again7: opts.windowDays === 7 ? againRate : this.calculateAgainRate(revlog, 7),
      again30: opts.windowDays === 30 ? againRate : this.calculateAgainRate(revlog, 30),
      backlogCount: overdue.length,
      backlogMedianDays: medianOverdue,
      overduenessIndex,
      streak: streaks.currentStreak,
      bestStreak: streaks.longestStreak,
      addsToday,
      addsWeek,
      addsMonth,
      reviewsPerMin,
      avgSecondsPerReview,
    };
  }

  /**
   * Get deck-specific snapshot with detailed metrics
   * Free tier method for deck analytics
   */
  getDeckSnapshot(
    deckId: string, 
    opts: { windowDays: 7 | 30 } = { windowDays: 7 }
  ): DeckSnapshot {
    const deck = this.db.getDeck(deckId);
    if (!deck) {
      throw new Error(`Deck ${deckId} not found`);
    }
    
    const deckCards = this.db.getCardsByDeck(deckId);
    const revlog = this.db.getAllRevlog();
    const deckRevlog = revlog.filter(r => {
      const card = this.db.getCard(r.cid);
      return card?.did === deckId;
    });
    
    // Calculate young/mature counts (mature = ivl >= 21 days)
    const MATURE_THRESHOLD = 21;
    const newCards = deckCards.filter(c => c.type === 0);
    const youngCards = deckCards.filter(c => 
      c.type === 2 && c.ivl > 0 && c.ivl < MATURE_THRESHOLD
    );
    const matureCards = deckCards.filter(c => 
      c.type === 2 && c.ivl >= MATURE_THRESHOLD
    );
    const suspended = deckCards.filter(c => c.queue === -1);
    const buried = deckCards.filter(c => c.queue === -2 || c.queue === -3);
    
    // Leeches (lapses >= 8 by default)
    const leeches = deckCards.filter(c => c.lapses >= 8);
    
    // Today's due (FIXED: respect deck's new perDay limit)
    const col = this.db.getCol();
    const now = Math.floor(Date.now() / 1000);
    const dayStart = Math.floor(col.crt / 86400);
    const currentDay = Math.floor(now / 86400) - dayStart;
    
    // Get deck config to respect new card limit
    const deckConfig = this.db.getDeckConfigForDeck(deckId);
    const newPerDay = deckConfig?.new?.perDay || 20;
    
    let dueToday = 0;
    let learnToday = 0;
    
    // Count new cards respecting perDay limit
    const availableNew = Math.min(newCards.length, newPerDay);
    dueToday += availableNew;
    
    // Add learning and review cards that are actually due (FIXED: use isDue)
    for (const c of deckCards) {
      if (!isDue(c.due, c.type, col, now)) continue; // Skip not due
      
      if (c.type === 1 || c.type === 3) { // Learning/relearning
        dueToday++;
        learnToday++;
      } else if (c.type === 2) { // Review
        dueToday++;
      }
    }
    
    // Retention for young/mature
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - opts.windowDays);
    const windowStartStr = this.dateToString(windowStart);
    
    const windowRevlog = deckRevlog.filter(r => {
      const date = this.timestampToDateString(parseInt(r.id, 10));
      return date >= windowStartStr;
    });
    
    const youngRevlog = windowRevlog.filter(r => {
      const card = this.db.getCard(r.cid);
      return card && card.ivl < MATURE_THRESHOLD;
    });
    
    const matureRevlog = windowRevlog.filter(r => {
      const card = this.db.getCard(r.cid);
      return card && card.ivl >= MATURE_THRESHOLD;
    });
    
    const youngRetention = this.calculateRetentionFromRevlog(youngRevlog);
    const matureRetention = this.calculateRetentionFromRevlog(matureRevlog);
    
    // Throughput
    const totalTime = windowRevlog.reduce((sum, r) => sum + r.time, 0);
    const rpm = windowRevlog.length > 0 && totalTime > 0
      ? (windowRevlog.length / (totalTime / 60000))
      : 0;
    const secPerReview = windowRevlog.length > 0
      ? (totalTime / windowRevlog.length / 1000)
      : 0;
    
    // Difficulty metrics
    const avgEase = deckCards.length > 0
      ? deckCards.reduce((sum, c) => sum + c.factor, 0) / deckCards.length / 10
      : 250; // Default 2500 permille = 250 in our format
    
    const totalReviews = deckRevlog.length;
    const totalLapses = deckCards.reduce((sum, c) => sum + c.lapses, 0);
    const lapsesPer100 = totalReviews > 0 ? (totalLapses / totalReviews) * 100 : 0;
    
    const againRate = this.calculateAgainRateFromRevlog(windowRevlog);
    
    // Difficulty index (0-100): weighted z-score
    // Higher again rate = harder, more lapses = harder, lower ease = harder
    const normalizedAgain = Math.min(againRate / 30, 1); // Cap at 30%
    const normalizedLapses = Math.min(lapsesPer100 / 20, 1); // Cap at 20 per 100
    const normalizedEase = Math.max(0, 1 - (avgEase / 300)); // Ease 250 = mid
    
    const difficultyIndex = Math.round(
      (normalizedAgain * 0.5 + normalizedLapses * 0.3 + normalizedEase * 0.2) * 100
    );
    
    // Time estimate
    const recentTimes = windowRevlog.map(r => r.time / 1000).sort((a, b) => a - b);
    const estTimeP50Sec = recentTimes.length > 0
      ? recentTimes[Math.floor(recentTimes.length * 0.5)] * dueToday
      : dueToday * 8;
    
    return {
      deckId,
      deckName: deck.name,
      counts: {
        new: newCards.length,
        young: youngCards.length,
        mature: matureCards.length,
        suspended: suspended.length,
        buried: buried.length,
        leeches: leeches.length,
        total: deckCards.length,
      },
      today: {
        due: dueToday,
        learn: learnToday,
        estTimeP50Sec,
      },
      retention: {
        young7: opts.windowDays === 7 ? youngRetention : this.calculateRetentionForCards(youngCards, 7),
        mature7: opts.windowDays === 7 ? matureRetention : this.calculateRetentionForCards(matureCards, 7),
        young30: opts.windowDays === 30 ? youngRetention : this.calculateRetentionForCards(youngCards, 30),
        mature30: opts.windowDays === 30 ? matureRetention : this.calculateRetentionForCards(matureCards, 30),
      },
      throughput: {
        rpm,
        secPerReview,
      },
      difficultyIndex,
      avgEase,
      lapsesPer100,
    };
  }

  // ============================================================================
  // HELPER METHODS FOR NEW STATS
  // ============================================================================

  private median(arr: number[]): number {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  private calculateRetention(revlog: AnkiRevlog[], days: number): number {
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - days);
    const windowStartStr = this.dateToString(windowStart);
    
    const windowRevlog = revlog.filter(r => {
      const date = this.timestampToDateString(parseInt(r.id, 10));
      return date >= windowStartStr;
    });
    
    return this.calculateRetentionFromRevlog(windowRevlog);
  }

  private calculateRetentionFromRevlog(revlog: AnkiRevlog[]): number {
    if (revlog.length === 0) return 0;
    const goodOrBetter = revlog.filter(r => r.ease >= 2).length;
    return (goodOrBetter / revlog.length) * 100;
  }

  private calculateAgainRate(revlog: AnkiRevlog[], days: number): number {
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - days);
    const windowStartStr = this.dateToString(windowStart);
    
    const windowRevlog = revlog.filter(r => {
      const date = this.timestampToDateString(parseInt(r.id, 10));
      return date >= windowStartStr;
    });
    
    return this.calculateAgainRateFromRevlog(windowRevlog);
  }

  private calculateAgainRateFromRevlog(revlog: AnkiRevlog[]): number {
    if (revlog.length === 0) return 0;
    const againCount = revlog.filter(r => r.ease === 1).length;
    return (againCount / revlog.length) * 100;
  }

  private calculateRetentionForCards(cards: AnkiCard[], days: number): number {
    const cardIds = new Set(cards.map(c => c.id));
    const revlog = this.db.getAllRevlog();
    
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - days);
    const windowStartStr = this.dateToString(windowStart);
    
    const relevantRevlog = revlog.filter(r => {
      const date = this.timestampToDateString(parseInt(r.id, 10));
      return date >= windowStartStr && cardIds.has(r.cid);
    });
    
    return this.calculateRetentionFromRevlog(relevantRevlog);
  }

  // ============================================================================
  // PHASE 4: HINT INTELLIGENCE METHODS
  // ============================================================================

  /**
   * Get comprehensive hint statistics
   * Shows hint adoption, effectiveness, and weak concepts
   */
  getHintStats(opts: { deckId?: string; days?: number } = {}): HintStats {
    const days = opts.days || 7;
    
    const adoptionPct = hintEventsRepository.getHintAdoptionRate(opts.deckId, days);
    const avgDepth = hintEventsRepository.getAverageHintDepth(opts.deckId, days);
    const effectiveness = hintEventsRepository.getHintEffectiveness(opts.deckId, days);
    
    // Get weak concepts if deck specified
    const weakConcepts = opts.deckId
      ? hintEventsRepository.getWeakConcepts(opts.deckId, days)
      : [];
    
    // Convert to weak tags format (simplified - would need tag data in real impl)
    const weakTags = weakConcepts.slice(0, 5).map((concept, idx) => ({
      tag: `Card ${concept.cardId.substring(0, 8)}`,
      againRate: 100 - concept.successRate,
      hintUsePct: concept.hintUsageRate,
    }));
    
    return {
      adoptionPct,
      avgDepth,
      successAfterHintPct: effectiveness.successWithHint,
      successWithoutHintPct: effectiveness.successWithoutHint, // FIXED: Return real value
      secDeltaAfterHint: effectiveness.timeDelta,
      weakTags,
    };
  }

  /**
   * Get global hint usage statistics (PARTIALLY STUBBED)
   * 
   * Returns avgDepth and mostUsedDepth, but totalHintsRevealed and 
   * totalReviewsWithHints are always 0 (not tracked in current implementation).
   * 
   * OK if unused in UI, or hide these zero fields.
   */
  getGlobalHintUsage(): {
    totalHintsRevealed: number;
    totalReviewsWithHints: number;
    mostUsedDepth: 1 | 2 | 3;
    avgDepth: number;
  } {
    const adoptionPct = hintEventsRepository.getHintAdoptionRate(undefined, 30);
    const avgDepth = hintEventsRepository.getAverageHintDepth(undefined, 30);
    
    return {
      totalHintsRevealed: 0, // TODO: Track total hints revealed (aggregate from HintEvent[])
      totalReviewsWithHints: 0, // TODO: Count reviewLinks with hintDepth !== null
      mostUsedDepth: Math.round(avgDepth) as 1 | 2 | 3 || 1,
      avgDepth,
    };
  }

  /**
   * Get forecast of future reviews (FIXED: respects deck new card limits)
   * 
   * Limitations:
   * - Doesn't propagate learning step repeats across days
   * - Uses flat 8 sec/card estimate (no historical p50)
   * 
   * TODO: Improve for production use or label as "estimate" in UI
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
      const dateStr = this.dateToString(targetDate);
      
      let newCount = 0;
      let learnCount = 0;
      let reviewCount = 0;
      
      // Handle new cards on day 0 with deck limits (FIXED)
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
          // Learning: due is epoch seconds, convert to days since crt (FIXED)
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
   * Get best hours for studying (when retention is highest)
   * FIXED: Implemented missing planned API with configurable minReviews
   */
  getBestHours(opts: { days?: number; deckId?: string; minReviews?: number } = {}): BestHoursData[] {
    const days = opts.days || 30;
    const revlog = this.db.getAllRevlog();
    
    // Filter by deck if specified
    const relevantRevlog = opts.deckId
      ? revlog.filter(r => {
          const card = this.db.getCard(r.cid);
          return card?.did === opts.deckId;
        })
      : revlog;
    
    // Filter by time window
    const since = Date.now() - days * 86400000;
    const windowRevlog = relevantRevlog.filter(r => parseInt(r.id, 10) >= since);
    
    // Group by hour of day (0-23)
    const hourData = new Map<number, { reviews: number; correct: number; timeTotal: number }>();
    
    for (let hour = 0; hour < 24; hour++) {
      hourData.set(hour, { reviews: 0, correct: 0, timeTotal: 0 });
    }
    
    for (const r of windowRevlog) {
      const timestamp = parseInt(r.id, 10);
      const date = new Date(timestamp);
      const hour = date.getHours();
      
      const data = hourData.get(hour)!;
      data.reviews++;
      if (r.ease >= 2) data.correct++;
      data.timeTotal += r.time;
    }
    
    // Calculate metrics for each hour (FIXED: minimum sample threshold)
    const minReviews = opts.minReviews ?? 20; // Default 20 reviews to avoid noise
    const results: BestHoursData[] = [];
    for (const [hour, data] of hourData) {
      if (data.reviews < minReviews) continue; // Skip hours with insufficient data
      
      results.push({
        hour,
        retentionPct: (data.correct / data.reviews) * 100,
        secPerReview: data.timeTotal / data.reviews / 1000,
        reviewCount: data.reviews,
      });
    }
    
    // Sort by weighted score (retention × log(reviews)) to favor both quality and sample size
    return results.sort((a, b) => {
      const scoreA = a.retentionPct * Math.log(a.reviewCount);
      const scoreB = b.retentionPct * Math.log(b.reviewCount);
      return scoreB - scoreA;
    });
  }

  /**
   * Get leeches (cards with high lapses)
   * Premium feature for identifying problem cards
   */
  getLeeches(opts: { deckId?: string; limit?: number; threshold?: number } = {}): Array<{
    cardId: string;
    lapses: number;
    factor: number;
    reps: number;
    question: string;
  }> {
    const threshold = opts.threshold || 8;
    const limit = opts.limit || 20;
    
    // Get cards, filter by deck if specified
    let cards = opts.deckId
      ? this.db.getCardsByDeck(opts.deckId)
      : this.db.getAllCards();
    
    // Filter to leeches (lapses >= threshold)
    const leeches = cards
      .filter(c => c.lapses >= threshold)
      .map(c => {
        const note = this.db.getNote(c.nid);
        const question = note?.flds?.split('\x1f')[0] || 'Unknown';
        
        return {
          cardId: c.id,
          lapses: c.lapses,
          factor: c.factor,
          reps: c.reps,
          question: question.substring(0, 100), // Limit to 100 chars
        };
      })
      .sort((a, b) => b.lapses - a.lapses)
      .slice(0, limit);
    
    return leeches;
  }

  /**
   * Get adds timeline (cards added over time)
   * Free tier feature for learning velocity tracking
   */
  getAddsTimeline(opts: { days?: number } = {}): Array<{ date: string; count: number }> {
    const days = opts.days || 30;
    const allCards = this.db.getAllCards();
    
    // Create date map
    const dateMap = new Map<string, number>();
    
    // Initialize all dates with 0
    const endDate = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(endDate);
      date.setDate(date.getDate() - i);
      dateMap.set(this.dateToString(date), 0);
    }
    
    // Count cards by creation date
    for (const card of allCards) {
      const creationDate = this.getCardCreationDate(card);
      if (creationDate) {
        const dateStr = this.dateToString(creationDate);
        if (dateMap.has(dateStr)) {
          dateMap.set(dateStr, (dateMap.get(dateStr) || 0) + 1);
        }
      }
    }
    
    // Convert to sorted array
    return Array.from(dateMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Get recent daily average review activity
   * Used for backlog clear-by projection
   */
  getRecentDailyAverage(opts: { days?: number } = {}): {
    avgReviewsPerDay: number;
    avgMinutesPerDay: number;
  } {
    const days = opts.days || 7;
    const revlog = this.db.getAllRevlog();
    
    // Filter to last N days
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - days);
    const windowStartStr = this.dateToString(windowStart);
    
    const recentRevlog = revlog.filter(r => {
      const date = this.timestampToDateString(parseInt(r.id, 10));
      return date >= windowStartStr;
    });
    
    // Calculate daily stats
    const dailyStats = this.calculateDailyStats(recentRevlog);
    
    if (dailyStats.length === 0) {
      return { avgReviewsPerDay: 0, avgMinutesPerDay: 0 };
    }
    
    // Calculate averages
    const totalReviews = dailyStats.reduce((sum, d) => sum + d.reviewCount, 0);
    const totalMinutes = dailyStats.reduce((sum, d) => sum + d.totalTimeMs, 0) / 60000;
    
    return {
      avgReviewsPerDay: totalReviews / days,
      avgMinutesPerDay: totalMinutes / days,
    };
  }

  // ============================================================================
  // PHASE 5: SIMULATOR & SURVIVAL METHODS
  // ============================================================================

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
    const windowStartStr = this.dateToString(windowStart);
    
    const recentRevlog = revlog.filter(r => {
      const date = this.timestampToDateString(parseInt(r.id, 10));
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
   * Calculate survival curves (HEURISTIC APPROXIMATION, not true Kaplan-Meier)
   * Uses 15% flat failure rate per interval - suitable for visualization only
   * TODO: Implement real Kaplan-Meier from revlog time-to-failure sequences
   */
  getSurvivalCurves(deckId?: string): {
    youngSurvival: Array<{ interval: number; survivalRate: number }>;
    matureSurvival: Array<{ interval: number; survivalRate: number }>;
    halfLifeYoung: number;
    halfLifeMature: number;
  } {
    const cards = deckId ? this.db.getCardsByDeck(deckId) : this.db.getAllCards();
    const MATURE_THRESHOLD = 21;
    
    const youngCards = cards.filter(c => c.type === 2 && c.ivl < MATURE_THRESHOLD);
    const matureCards = cards.filter(c => c.type === 2 && c.ivl >= MATURE_THRESHOLD);
    
    const calculateSurvival = (cardSet: typeof cards) => {
      if (cardSet.length === 0) {
        return { curve: [], halfLife: 0 };
      }
      
      // Group by interval
      const intervalGroups = new Map<number, number>();
      cardSet.forEach(c => {
        intervalGroups.set(c.ivl, (intervalGroups.get(c.ivl) || 0) + 1);
      });
      
      // Calculate cumulative survival
      const intervals = Array.from(intervalGroups.keys()).sort((a, b) => a - b);
      const curve: Array<{ interval: number; survivalRate: number }> = [];
      
      let remaining = cardSet.length;
      intervals.forEach(interval => {
        const count = intervalGroups.get(interval) || 0;
        remaining -= count * 0.15; // Assume 15% failure rate per interval
        const survivalRate = Math.max(0, (remaining / cardSet.length) * 100);
        curve.push({ interval, survivalRate });
        
        // Add interpolated points for smooth curve
        if (curve.length > 0 && interval > 1) {
          const prevInterval = curve[curve.length - 2]?.interval || 0;
          const prevRate = curve[curve.length - 2]?.survivalRate || 100;
          const step = Math.max(1, Math.floor((interval - prevInterval) / 5));
          
          for (let i = prevInterval + step; i < interval; i += step) {
            const interpolatedRate = prevRate - ((prevRate - survivalRate) * (i - prevInterval)) / (interval - prevInterval);
            curve.push({ interval: i, survivalRate: interpolatedRate });
          }
        }
      });
      
      // Find half-life (50% survival)
      const halfLifePoint = curve.find(p => p.survivalRate <= 50);
      const halfLife = halfLifePoint?.interval || intervals[intervals.length - 1] || 0;
      
      return { curve: curve.sort((a, b) => a.interval - b.interval), halfLife };
    };
    
    const youngResult = calculateSurvival(youngCards);
    const matureResult = calculateSurvival(matureCards);
    
    return {
      youngSurvival: youngResult.curve,
      matureSurvival: matureResult.curve,
      halfLifeYoung: youngResult.halfLife,
      halfLifeMature: matureResult.halfLife,
    };
  }

  /**
   * Generate weekly coach report insights
   * Analyzes patterns and provides recommendations
   */
  getWeeklyCoachReport(): WeeklyCoachReport {
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - 7);
    
    const weekStartStr = this.dateToString(weekStart);
    const weekEndStr = this.dateToString(today);
    
    const revlog = this.db.getAllRevlog();
    const weekRevlog = revlog.filter(r => {
      const date = this.timestampToDateString(parseInt(r.id, 10));
      return date >= weekStartStr && date <= weekEndStr;
    });
    
    const allCards = this.db.getAllCards();
    const weekCards = allCards.filter(c => {
      const cardDate = this.timestampToDateString(c.id as any);
      return cardDate >= weekStartStr && cardDate <= weekEndStr;
    });
    
    const totalReviews = weekRevlog.length;
    const successfulReviews = weekRevlog.filter(r => r.ease >= 2).length;
    const avgAccuracy = totalReviews > 0 ? (successfulReviews / totalReviews) * 100 : 0;
    
    // Calculate streak
    const dailyStats = this.calculateDailyStats(revlog);
    const streaks = this.calculateStreaks(dailyStats);
    
    // Generate insights
    const insights: Array<{
      type: 'success' | 'warning' | 'info' | 'action';
      title: string;
      message: string;
      actionText?: string;
    }> = [];
    
    // Streak insight
    if (streaks.currentStreak >= 7) {
      insights.push({
        type: 'success',
        title: '🔥 Amazing Consistency!',
        message: `You've maintained a ${streaks.currentStreak}-day streak. Keep the momentum going!`,
      });
    } else if (streaks.currentStreak === 0) {
      insights.push({
        type: 'action',
        title: 'Start Your Streak',
        message: 'Study today to begin building a consistent habit.',
        actionText: 'Study Now',
      });
    }
    
    // Accuracy insight
    if (avgAccuracy >= 85) {
      insights.push({
        type: 'success',
        title: 'Excellent Retention',
        message: `${Math.round(avgAccuracy)}% accuracy this week. Your study methods are working!`,
      });
    } else if (avgAccuracy < 70) {
      insights.push({
        type: 'warning',
        title: 'Retention Needs Attention',
        message: `Your accuracy is at ${Math.round(avgAccuracy)}%. Consider reviewing difficult cards more frequently.`,
        actionText: 'View Weak Cards',
      });
    }
    
    // Volume insight
    if (totalReviews > 100) {
      insights.push({
        type: 'success',
        title: 'High Volume Week',
        message: `${totalReviews} reviews completed! You're making great progress.`,
      });
    } else if (totalReviews < 20 && totalReviews > 0) {
      insights.push({
        type: 'info',
        title: 'Light Study Week',
        message: 'Try to increase your daily review target for better retention.',
        actionText: 'Adjust Settings',
      });
    }
    
    // New cards insight
    if (weekCards.length > 50) {
      insights.push({
        type: 'warning',
        title: 'High New Card Volume',
        message: `You added ${weekCards.length} cards this week. Make sure you can handle the review load.`,
      });
    }
    
    return {
      weekStart: weekStartStr,
      weekEnd: weekEndStr,
      insights,
      summary: {
        totalReviews,
        avgAccuracy,
        streakDays: streaks.currentStreak,
        cardsAdded: weekCards.length,
      },
    };
  }
}
