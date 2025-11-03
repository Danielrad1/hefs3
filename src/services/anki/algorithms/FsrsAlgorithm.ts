/**
 * FSRS Algorithm (Free Spaced Repetition Scheduler)
 * Modern, data-driven scheduler that learns from review history
 * Stores stability (S) and difficulty (D) per card
 * 
 * This is a simplified FSRS v4-style implementation
 * Can be enhanced with parameter training from revlog
 */

import {
  AnkiCard,
  RevlogEase,
  DeckConfig,
  CardType,
  CardQueue,
} from '../schema';
import { IAlgorithm, AlgorithmHelpers } from './IAlgorithm';

/**
 * FSRS state stored in card.data
 */
interface FsrsState {
  /** Stability: predicted interval (days) at which retention = target */
  s: number;
  /** Difficulty: 0-10 scale (higher = more difficult) */
  d: number;
  /** Last review timestamp (seconds) */
  last: number;
}

/**
 * FSRS parameters (can be trained per deck)
 */
interface FsrsParams {
  /** Target retention (0-1, default 0.9) */
  retention: number;
  /** Default weights (can be optimized from revlog) */
  weights: number[];
}

/**
 * Parse FSRS state from card.data field
 */
function parseFsrsState(card: AnkiCard): FsrsState | null {
  try {
    if (!card.data) return null;
    const parsed = JSON.parse(card.data);
    return parsed.fsrs || null;
  } catch {
    return null;
  }
}

/**
 * Store FSRS state in card.data field
 */
function storeFsrsState(card: AnkiCard, fsrsState: FsrsState): string {
  try {
    const parsed = card.data ? JSON.parse(card.data) : {};
    parsed.fsrs = fsrsState;
    return JSON.stringify(parsed);
  } catch {
    return JSON.stringify({ fsrs: fsrsState });
  }
}

export class FsrsAlgorithm implements IAlgorithm {
  readonly name = 'fsrs';

  /**
   * Get FSRS parameters from deck config
   */
  private getParams(config: DeckConfig): FsrsParams {
    const algoParams = (config as any).algoParams?.fsrs || {};
    return {
      retention: algoParams.retention || 0.9,
      // Default weights (simplified FSRS v4 starting weights)
      weights: algoParams.weights || [
        0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61
      ],
    };
  }

  initNew(
    card: AnkiCard,
    config: DeckConfig,
    helpers: AlgorithmHelpers
  ): Partial<AnkiCard> {
    // Initialize FSRS state for new card
    const fsrsState: FsrsState = {
      s: 0.4, // Initial stability (short interval)
      d: 5.0, // Initial difficulty (medium)
      last: helpers.nowSeconds,
    };

    return {
      data: storeFsrsState(card, fsrsState),
    };
  }

  scheduleAnswer(
    card: AnkiCard,
    ease: RevlogEase,
    config: DeckConfig,
    helpers: AlgorithmHelpers
  ): Partial<AnkiCard> {
    const params = this.getParams(config);
    let fsrsState = parseFsrsState(card);

    // Initialize if missing
    if (!fsrsState) {
      fsrsState = {
        s: card.ivl > 0 ? card.ivl : 0.4,
        d: 5.0,
        last: helpers.nowSeconds - (card.ivl > 0 ? card.ivl * 86400 : 0),
      };
    }

    // Calculate time elapsed since last review (days)
    const elapsed = (helpers.nowSeconds - fsrsState.last) / 86400;

    // Calculate retrievability (probability of recall)
    const retrievability = this.calculateRetrievability(elapsed, fsrsState.s);

    // Update stability and difficulty based on answer
    const newS = this.updateStability(fsrsState.s, fsrsState.d, retrievability, ease, params);
    const newD = this.updateDifficulty(fsrsState.d, ease);

    // Calculate next interval from stability
    const nextInterval = this.stabilityToInterval(newS, params.retention);

    // Update FSRS state
    const newFsrsState: FsrsState = {
      s: newS,
      d: newD,
      last: helpers.nowSeconds,
    };

    // Determine card type/queue based on interval
    let type: CardType;
    let queue: CardQueue;
    let due: number;
    let ivl: number;

    if (ease === RevlogEase.Again) {
      // Lapse: short relearning interval
      type = CardType.Relearning;
      queue = CardQueue.Learning;
      const relearnMinutes = Math.max(1, Math.floor(newS * 24 * 60)); // Convert to minutes, min 1
      due = helpers.addMinutes(helpers.nowSeconds, Math.min(relearnMinutes, 10)); // Cap at 10 minutes
      ivl = 0;
    } else if (nextInterval < 1) {
      // Very short interval: use learning queue with seconds
      type = card.type === CardType.New ? CardType.Learning : CardType.Relearning;
      queue = CardQueue.Learning;
      const minutes = Math.max(1, Math.floor(nextInterval * 24 * 60));
      due = helpers.addMinutes(helpers.nowSeconds, minutes);
      ivl = 0;
    } else {
      // Normal review: use days
      type = CardType.Review;
      queue = CardQueue.Review;
      ivl = Math.max(1, Math.round(nextInterval));
      due = helpers.daysSinceCrt(helpers.nowSeconds) + ivl;
    }

    return {
      type,
      queue,
      due,
      ivl,
      reps: card.reps + 1,
      lapses: ease === RevlogEase.Again ? card.lapses + 1 : card.lapses,
      data: storeFsrsState(card, newFsrsState),
      left: 0, // FSRS doesn't use learning steps
    };
  }

  // ==========================================================================
  // FSRS CORE FUNCTIONS
  // ==========================================================================

  /**
   * Calculate retrievability (probability of recall) at time t
   * R(t) = exp(-t / (S * 9))
   */
  private calculateRetrievability(elapsed: number, stability: number): number {
    // Use FSRS decay formula
    // R(t) = (1 + elapsed / (9 * stability))^(-1)
    return Math.pow(1 + elapsed / (9 * stability), -1);
  }

  /**
   * Update stability based on answer quality
   * Simplified FSRS v4 update rules
   */
  private updateStability(
    s: number,
    d: number,
    r: number,
    ease: RevlogEase,
    params: FsrsParams
  ): number {
    // Simplified stability update
    // Again: reduce significantly
    // Hard: small increase
    // Good: medium increase
    // Easy: large increase

    const w = params.weights;
    
    if (ease === RevlogEase.Again) {
      // Lapse: stability decreases
      return Math.max(0.1, s * 0.5 * Math.exp(w[11] * (d - 5)));
    } else {
      // Success: stability increases
      let successFactor: number;
      if (ease === RevlogEase.Hard) {
        successFactor = 1.2;
      } else if (ease === RevlogEase.Good) {
        successFactor = 2.5;
      } else {
        // Easy
        successFactor = 3.5;
      }

      // Factor in difficulty and retrievability
      const newS = s * successFactor * Math.exp(w[8] * (1 - r)) * Math.exp(w[9] * (5 - d));
      return Math.max(0.1, Math.min(newS, 36500)); // Cap at 100 years
    }
  }

  /**
   * Update difficulty based on answer quality
   * Difficulty increases on Again, decreases on Easy
   */
  private updateDifficulty(d: number, ease: RevlogEase): number {
    let delta = 0;

    if (ease === RevlogEase.Again) {
      delta = 0.8; // Increase difficulty
    } else if (ease === RevlogEase.Hard) {
      delta = 0.2; // Small increase
    } else if (ease === RevlogEase.Good) {
      delta = -0.1; // Small decrease
    } else {
      // Easy
      delta = -0.3; // Larger decrease
    }

    const newD = d + delta;
    return Math.max(1, Math.min(newD, 10)); // Clamp to [1, 10]
  }

  /**
   * Convert stability to interval at target retention
   * I = S * ln(target_retention) / ln(0.9)
   */
  private stabilityToInterval(stability: number, targetRetention: number): number {
    // I = 9 * S * (1/R - 1) where R is target retention
    const interval = 9 * stability * (1 / targetRetention - 1);
    return Math.max(0.01, interval); // Minimum 0.01 days (~15 minutes)
  }
}
