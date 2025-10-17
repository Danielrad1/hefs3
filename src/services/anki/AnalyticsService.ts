/**
 * Analytics Service
 * Handles advanced metrics: best hours, hints, leeches, survival curves, coach reports
 * Extracted from bloated StatsService for maintainability
 */

import { InMemoryDb } from './InMemoryDb';
import { AnkiRevlog, AnkiCard } from './schema';
import { hintEventsRepository } from './db/HintEventsRepository';
import { CoreStatsService } from './CoreStatsService';

export interface BestHoursData {
  hour: number; // 0-23
  retentionPct: number;
  secPerReview: number;
  reviewCount: number;
}

export interface HintStats {
  adoptionPct: number;
  avgDepth: number; // 1-3
  successAfterHintPct: number;
  successWithoutHintPct: number;
  secDeltaAfterHint: number;
  weakTags: Array<{
    tag: string;
    againRate: number;
    hintUsePct: number;
  }>;
}

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

export class AnalyticsService {
  private core: CoreStatsService;

  constructor(private db: InMemoryDb) {
    this.core = new CoreStatsService(db);
  }

  /**
   * Get best hours for studying (when retention is highest)
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
    
    // Calculate metrics for each hour (minimum sample threshold)
    const minReviews = opts.minReviews ?? 20; // Default 20 reviews to avoid noise
    const results: BestHoursData[] = [];
    hourData.forEach((data, hour) => {
      if (data.reviews < minReviews) return; // Skip hours with insufficient data
      
      results.push({
        hour,
        retentionPct: (data.correct / data.reviews) * 100,
        secPerReview: data.timeTotal / data.reviews / 1000,
        reviewCount: data.reviews,
      });
    });
    
    // Sort by weighted score (retention × log(reviews)) to favor both quality and sample size
    return results.sort((a, b) => {
      const scoreA = a.retentionPct * Math.log(a.reviewCount);
      const scoreB = b.retentionPct * Math.log(b.reviewCount);
      return scoreB - scoreA;
    });
  }

  /**
   * Get leeches (cards with high lapses)
   */
  getLeeches(opts: { deckId?: string; limit?: number; threshold?: number } = {}): Array<{
    cardId: string;
    lapses: number;
    factor: number;
    reps: number;
    question: string;
  }> {
    const limit = opts.limit || 20;
    const threshold = opts.threshold || 3;
    
    const allCards = opts.deckId 
      ? this.db.getCardsByDeck(opts.deckId)
      : this.db.getAllCards();
    
    // Filter cards with lapses >= threshold
    const leeches = allCards
      .filter(c => c.lapses >= threshold)
      .sort((a, b) => b.lapses - a.lapses)
      .slice(0, limit);
    
    return leeches.map(c => {
      const note = this.db.getNote(c.nid);
      const question = note ? note.flds.split('\x1f')[0] : 'Unknown';
      
      return {
        cardId: c.id,
        lapses: c.lapses,
        factor: c.factor,
        reps: c.reps,
        question,
      };
    });
  }

  /**
   * Get comprehensive hint statistics
   */
  getHintStats(opts: { deckId?: string; days?: number } = {}): HintStats {
    const days = opts.days || 7;
    
    const adoptionPct = hintEventsRepository.getHintAdoptionRate(opts.deckId, days);
    const avgDepth = hintEventsRepository.getAverageHintDepth(opts.deckId, days);
    const outcomes = hintEventsRepository.getHintEffectiveness(opts.deckId, days);
    const successAfterHintPct = outcomes.successWithHint;
    const successWithoutHintPct = outcomes.successWithoutHint;
    const secDeltaAfterHint = outcomes.timeDelta;
    
    // Get weak concepts (cards with high hint usage + low success)
    const weakConcepts = opts.deckId 
      ? hintEventsRepository.getWeakConcepts(opts.deckId, days)
      : [];
    
    // Convert to tag-based format (simplified - just returning card-based data)
    const weakTags = weakConcepts.slice(0, 10).map(wc => ({
      tag: wc.cardId.substring(0, 8), // Use card ID prefix as "tag" for now
      againRate: 100 - wc.successRate,
      hintUsePct: wc.hintUsageRate,
    }));
    
    return {
      adoptionPct,
      avgDepth,
      successAfterHintPct,
      successWithoutHintPct,
      secDeltaAfterHint,
      weakTags,
    };
  }

  /**
   * Get global hint usage statistics
   */
  getGlobalHintUsage(): {
    totalHintsRevealed: number;
    totalReviewsWithHints: number;
    mostUsedDepth: 1 | 2 | 3;
  } {
    // Simplified implementation - these methods don't exist yet in HintEventsRepository
    // Return placeholder data for now
    return {
      totalHintsRevealed: 0,
      totalReviewsWithHints: 0,
      mostUsedDepth: 1,
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
   */
  getWeeklyCoachReport(): WeeklyCoachReport {
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - 7);
    
    const weekStartStr = this.core.dateToString(weekStart);
    const weekEndStr = this.core.dateToString(today);
    
    const revlog = this.db.getAllRevlog();
    const weekRevlog = revlog.filter(r => {
      const date = this.core.timestampToDateString(parseInt(r.id, 10));
      return date >= weekStartStr && date <= weekEndStr;
    });
    
    const allCards = this.db.getAllCards();
    const weekCards = allCards.filter(c => {
      const cardDate = this.core.timestampToDateString(c.id as any);
      return cardDate >= weekStartStr && cardDate <= weekEndStr;
    });
    
    const totalReviews = weekRevlog.length;
    const successfulReviews = weekRevlog.filter(r => r.ease >= 2).length;
    const avgAccuracy = totalReviews > 0 ? (successfulReviews / totalReviews) * 100 : 0;
    
    // Calculate streak
    const dailyStats = this.core.calculateDailyStats(revlog);
    const streaks = this.core.calculateStreaks(dailyStats);
    
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
