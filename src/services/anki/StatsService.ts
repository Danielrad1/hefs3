/**
 * Statistics Service (Refactored Facade)
 * 
 * This service now acts as a lightweight facade that delegates to focused services:
 * - CoreStatsService: Basic counts, streaks, daily stats
 * - ForecastService: Workload predictions, simulations
 * - AnalyticsService: Advanced metrics (best hours, hints, survival curves, coach reports)
 * 
 * This refactoring maintains backward compatibility while improving maintainability.
 */

import { InMemoryDb } from './InMemoryDb';
import { AnkiCard, AnkiRevlog } from './schema';
import { nowSeconds, isDue } from './time';
import { TodayCountsService } from './TodayCountsService';
import { CoreStatsService, HomeStats, DailyStats, GlobalSnapshot } from './CoreStatsService';
import { ForecastService, ForecastPoint } from './ForecastService';
import { AnalyticsService, BestHoursData, HintStats, WeeklyCoachReport } from './AnalyticsService';

// Re-export types for backward compatibility
export type { HomeStats, DailyStats, GlobalSnapshot, ForecastPoint, BestHoursData, HintStats, WeeklyCoachReport };

// Additional types from old StatsService
export interface DeckSnapshot {
  deckId: string;
  deckName: string;
  counts: {
    new: number;
    young: number;  // ivl < 21 days
    mature: number; // ivl >= 21 days
    suspended: number;
    buried: number;
    leeches: number;
    total: number;
  };
  today: {
    due: number;
    learn: number;
    estTimeP50Sec: number;
  };
  retention: {
    young7: number;
    mature7: number;
    young30: number;
    mature30: number;
  };
  throughput: {
    rpm: number; // reviews per minute
    secPerReview: number;
  };
  difficultyIndex: number; // 0-100 composite score
  avgEase: number;
  lapsesPer100: number;
}

/**
 * Main StatsService - delegates to focused services
 */
export class StatsService {
  private core: CoreStatsService;
  private db: InMemoryDb;
  private todayCountsService: TodayCountsService;
  private forecast: ForecastService;
  private analytics: AnalyticsService;

  constructor(db: InMemoryDb) {
    this.db = db;
    this.core = new CoreStatsService(db);
    this.todayCountsService = new TodayCountsService(db);
    this.forecast = new ForecastService(db);
    this.analytics = new AnalyticsService(db);
  }

  // ============================================================================
  // CORE STATS (delegated to CoreStatsService)
  // ============================================================================

  getHomeStats(): HomeStats {
    return this.core.getHomeStats();
  }

  getGlobalSnapshot(opts: { windowDays: 7 | 30 } = { windowDays: 7 }): GlobalSnapshot {
    const today = this.core.getTodayString();
    const revlog = this.db.getAllRevlog();
    const allCards = this.db.getAllCards();
    const now = nowSeconds();
    
    // Use TodayCountsService for accurate due counts with daily limits
    const colConfig = this.db.getColConfig();
    const allDecks = this.db.getAllDecks().filter(d => d.id !== '1'); // Exclude default deck
    const activeDecks = colConfig?.activeDecks || allDecks.map(d => d.id);
    
    // TodayCountsService expects milliseconds (converts internally to seconds)
    const globalCounts = this.todayCountsService.getGlobalTodayCounts(activeDecks, Date.now());
    const dueCount = globalCounts.dueTodayTotal;
    const learnCount = globalCounts.learningTotal;
    const currentDay = Math.floor(now / 86400);
    
    // Filter revlog by window
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - opts.windowDays);
    const windowStartStr = this.core.dateToString(windowStart);
    
    const windowRevlog = revlog.filter(r => {
      const date = this.core.timestampToDateString(parseInt(r.id, 10));
      return date >= windowStartStr;
    });
    
    // Calculate retention and again rate
    const retention = this.core.calculateRetentionFromRevlog(windowRevlog);
    const againRate = this.core.calculateAgainRateFromRevlog(windowRevlog);
    
    // Retention for 7 and 30 days
    const retention7 = this.core.calculateRetention(revlog, 7);
    const retention30 = this.core.calculateRetention(revlog, 30);
    const again7 = this.core.calculateAgainRate(revlog, 7);
    const again30 = this.core.calculateAgainRate(revlog, 30);
    
    // Today's reviews
    const todayRevlog = revlog.filter(r => 
      this.core.timestampToDateString(parseInt(r.id, 10)) === today
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
    
    const medianOverdue = overdueDays.length > 0 ? this.core.median(overdueDays) : 0;
    
    // Overdueness index
    const overduenessIndex = overdueDays.reduce((sum, days) => 
      sum + Math.min(days, 30), 0
    ) / Math.max(allCards.length, 1);
    
    // Streaks
    const dailyStats = this.core.calculateDailyStats(revlog);
    const streaks = this.core.calculateStreaks(dailyStats);
    
    // Adds over time
    const addsToday = allCards.filter(c => {
      const cardDate = this.core.getCardCreationDate(c);
      return cardDate !== null && this.core.dateToString(cardDate) === today;
    }).length;
    
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = this.core.dateToString(weekAgo);
    const addsWeek = allCards.filter(c => {
      const cardDate = this.core.getCardCreationDate(c);
      return cardDate !== null && this.core.dateToString(cardDate) >= weekAgoStr;
    }).length;
    
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);
    const monthAgoStr = this.core.dateToString(monthAgo);
    const addsMonth = allCards.filter(c => {
      const cardDate = this.core.getCardCreationDate(c);
      return cardDate !== null && this.core.dateToString(cardDate) >= monthAgoStr;
    }).length;
    
    // Efficiency metrics
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
      ? recentTimes[Math.floor(recentTimes.length / 2)]
      : 0; // Return 0 when no data available
    
    return {
      date: today,
      todayDue: dueCount,
      todayLearn: learnCount,
      todayNewLimit: globalCounts.newTotal, // Actual new cards available today
      estTimeP50Sec,
      reviewsToday: todayReviewCount,
      minutesToday: Math.round(todayTimeMs / 60000),
      retention7,
      retention30,
      again7,
      again30,
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

  getDeckSnapshot(deckId: string, opts: { windowDays: 7 | 30 } = { windowDays: 7 }): DeckSnapshot {
    const deck = this.db.getDeck(deckId);
    if (!deck) {
      throw new Error(`Deck not found: ${deckId}`);
    }
    
    const cards = this.db.getCardsByDeck(deckId);
    const revlog = this.db.getAllRevlog().filter(r => {
      const card = this.db.getCard(r.cid);
      return card?.did === deckId;
    });
    
    // Calculate counts
    const newCount = cards.filter(c => c.type === 0).length;
    const MATURE_THRESHOLD = 21;
    const youngCount = cards.filter(c => c.type === 2 && c.ivl < MATURE_THRESHOLD).length;
    const matureCount = cards.filter(c => c.type === 2 && c.ivl >= MATURE_THRESHOLD).length;
    const suspendedCount = cards.filter(c => c.queue === -1).length;
    const buriedCount = cards.filter(c => c.queue === -2 || c.queue === -3).length;
    const leechCount = cards.filter(c => c.lapses >= 3).length;
    
    // Today's due - use TodayCountsService for accurate counts with daily limits
    // TodayCountsService expects milliseconds (converts internally to seconds)
    const deckCounts = this.todayCountsService.getDeckTodayCounts(deckId, Date.now());
    const dueToday = deckCounts.dueTodayTotal;
    const learnToday = deckCounts.learningDueToday;
    
    // Retention by maturity
    const youngCards = cards.filter(c => c.type === 2 && c.ivl < MATURE_THRESHOLD);
    const matureCards = cards.filter(c => c.type === 2 && c.ivl >= MATURE_THRESHOLD);
    
    const young7 = this.calculateRetentionForCards(youngCards, 7);
    const young30 = this.calculateRetentionForCards(youngCards, 30);
    const mature7 = this.calculateRetentionForCards(matureCards, 7);
    const mature30 = this.calculateRetentionForCards(matureCards, 30);
    
    // Throughput (from today's activity)
    const today = this.core.getTodayString();
    const todayRevlog = revlog.filter(r => this.core.timestampToDateString(parseInt(r.id, 10)) === today);
    const todayTimeMs = todayRevlog.reduce((sum, r) => sum + r.time, 0);
    const rpm = todayRevlog.length > 0 && todayTimeMs > 0
      ? (todayRevlog.length / (todayTimeMs / 60000))
      : 0;
    const secPerReview = todayRevlog.length > 0
      ? (todayTimeMs / 1000) / todayRevlog.length
      : 0;
    
    // Difficulty metrics
    const reviewCards = cards.filter(c => c.type === 2);
    const avgEase = reviewCards.length > 0
      ? reviewCards.reduce((sum, c) => sum + c.factor, 0) / reviewCards.length / 10
      : 250;
    
    const lapsesPer100 = reviewCards.length > 0
      ? (reviewCards.reduce((sum, c) => sum + c.lapses, 0) / reviewCards.length) * 100
      : 0;
    
    // Difficulty index: composite of ease, lapses, and retention
    const easePart = Math.max(0, (300 - avgEase) / 2); // 0-50
    const lapsePart = Math.min(30, lapsesPer100 * 0.3); // 0-30
    const retentionPart = Math.max(0, (100 - young7) * 0.2); // 0-20
    const difficultyIndex = Math.min(100, easePart + lapsePart + retentionPart);
    
    // Estimate time
    const recentTimes = todayRevlog.map(r => r.time / 1000).sort((a, b) => a - b);
    const estTimeP50Sec = recentTimes.length > 0
      ? recentTimes[Math.floor(recentTimes.length / 2)]
      : 8;
    
    return {
      deckId,
      deckName: deck.name,
      counts: {
        new: newCount,
        young: youngCount,
        mature: matureCount,
        suspended: suspendedCount,
        buried: buriedCount,
        leeches: leechCount,
        total: cards.length,
      },
      today: {
        due: dueToday,
        learn: learnToday,
        estTimeP50Sec,
      },
      retention: {
        young7,
        mature7,
        young30,
        mature30,
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

  getRecentDailyAverage(opts: { days?: number } = {}) {
    return this.core.getRecentDailyAverage(opts);
  }

  // ============================================================================
  // FORECAST (delegated to ForecastService)
  // ============================================================================

  getForecast(opts: { days: number; deckId?: string }): ForecastPoint[] {
    return this.forecast.getForecast(opts);
  }

  simulateWorkload(newPerDay: number, targetDays: number) {
    return this.forecast.simulateWorkload(newPerDay, targetDays);
  }

  getAddsTimeline(opts: { days?: number } = {}) {
    return this.forecast.getAddsTimeline(opts);
  }

  // ============================================================================
  // ANALYTICS (delegated to AnalyticsService)
  // ============================================================================

  getBestHours(opts: { days?: number; deckId?: string; minReviews?: number } = {}) {
    return this.analytics.getBestHours(opts);
  }

  getLeeches(opts: { deckId?: string; limit?: number; threshold?: number } = {}) {
    return this.analytics.getLeeches(opts);
  }

  getHintStats(opts: { deckId?: string; days?: number } = {}) {
    return this.analytics.getHintStats(opts);
  }

  getGlobalHintUsage() {
    return this.analytics.getGlobalHintUsage();
  }

  getSurvivalCurves(deckId?: string) {
    return this.analytics.getSurvivalCurves(deckId);
  }

  getWeeklyCoachReport() {
    return this.analytics.getWeeklyCoachReport();
  }

  // ============================================================================
  // HELPER METHODS (for deck snapshot)
  // ============================================================================

  private calculateRetentionForCards(cards: AnkiCard[], days: number): number {
    const cardIds = new Set(cards.map(c => c.id));
    const revlog = this.db.getAllRevlog();
    
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - days);
    const windowStartStr = this.core.dateToString(windowStart);
    
    const relevantRevlog = revlog.filter(r => {
      const date = this.core.timestampToDateString(parseInt(r.id, 10));
      return date >= windowStartStr && cardIds.has(r.cid);
    });
    
    return this.core.calculateRetentionFromRevlog(relevantRevlog);
  }
}
