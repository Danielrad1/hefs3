/**
 * Leitner Algorithm (Simple Box System)
 * Cards progress through numbered boxes with increasing intervals
 * Correct answer → advance to next box
 * Wrong answer → return to box 0 (or drop by N boxes)
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
 * Leitner state stored in card.data
 */
interface LeitnerState {
  /** Current box number (0-based) */
  box: number;
  /** Last review timestamp (seconds) */
  last: number;
}

/**
 * Leitner parameters from deck config
 */
interface LeitnerParams {
  /** Interval table: box number → interval in days */
  intervals: number[];
  /** How many boxes to drop on wrong answer (0 = reset to box 0) */
  dropBoxes: number;
}

/**
 * Parse Leitner state from card.data field
 */
function parseLeitnerState(card: AnkiCard): LeitnerState | null {
  try {
    if (!card.data) return null;
    const parsed = JSON.parse(card.data);
    return parsed.leitner || null;
  } catch {
    return null;
  }
}

/**
 * Store Leitner state in card.data field
 */
function storeLeitnerState(card: AnkiCard, leitnerState: LeitnerState): string {
  try {
    const parsed = card.data ? JSON.parse(card.data) : {};
    parsed.leitner = leitnerState;
    return JSON.stringify(parsed);
  } catch {
    return JSON.stringify({ leitner: leitnerState });
  }
}

export class LeitnerAlgorithm implements IAlgorithm {
  readonly name = 'leitner';

  /**
   * Get Leitner parameters from deck config
   */
  private getParams(config: DeckConfig): LeitnerParams {
    const algoParams = (config as any).algoParams?.leitner || {};
    return {
      // Default intervals: 10min, 1d, 2d, 4d, 8d, 16d, 32d, 64d
      intervals: algoParams.intervals || [
        10 / 1440, // 10 minutes (in days)
        1,
        2,
        4,
        8,
        16,
        32,
        64,
      ],
      dropBoxes: algoParams.dropBoxes ?? 0, // Default: reset to box 0
    };
  }

  initNew(
    card: AnkiCard,
    config: DeckConfig,
    helpers: AlgorithmHelpers
  ): Partial<AnkiCard> {
    // Initialize Leitner state for new card
    const leitnerState: LeitnerState = {
      box: 0,
      last: helpers.nowSeconds,
    };

    return {
      data: storeLeitnerState(card, leitnerState),
    };
  }

  scheduleAnswer(
    card: AnkiCard,
    ease: RevlogEase,
    config: DeckConfig,
    helpers: AlgorithmHelpers
  ): Partial<AnkiCard> {
    const params = this.getParams(config);
    let leitnerState = parseLeitnerState(card);

    // Initialize if missing
    if (!leitnerState) {
      leitnerState = {
        box: 0,
        last: helpers.nowSeconds,
      };
    }

    // Update box based on answer
    let newBox: number;

    if (ease === RevlogEase.Again) {
      // Wrong: drop boxes or reset to 0
      if (params.dropBoxes === 0) {
        newBox = 0;
      } else {
        newBox = Math.max(0, leitnerState.box - params.dropBoxes);
      }
    } else {
      // Correct: advance to next box (Hard/Good/Easy all advance by 1)
      // Could differentiate: Hard=same, Good=+1, Easy=+2
      let advance = 1;
      if (ease === RevlogEase.Easy) {
        advance = 2; // Easy skips a box
      } else if (ease === RevlogEase.Hard) {
        advance = 0; // Hard stays in same box
      }
      
      newBox = Math.min(
        leitnerState.box + advance,
        params.intervals.length - 1
      );
    }

    // Get interval for new box
    const intervalDays = params.intervals[newBox];

    // Update Leitner state
    const newLeitnerState: LeitnerState = {
      box: newBox,
      last: helpers.nowSeconds,
    };

    // Determine card type/queue based on interval
    let type: CardType;
    let queue: CardQueue;
    let due: number;
    let ivl: number;

    if (intervalDays < 1) {
      // Short interval: use learning queue with minutes
      type = card.type === CardType.New ? CardType.Learning : CardType.Relearning;
      queue = CardQueue.Learning;
      const minutes = Math.max(1, Math.floor(intervalDays * 24 * 60));
      due = helpers.addMinutes(helpers.nowSeconds, minutes);
      ivl = 0;
    } else {
      // Normal interval: use review queue with days
      type = CardType.Review;
      queue = CardQueue.Review;
      ivl = Math.max(1, Math.round(intervalDays));
      due = helpers.daysSinceCrt(helpers.nowSeconds) + ivl;
    }

    return {
      type,
      queue,
      due,
      ivl,
      reps: card.reps + 1,
      lapses: ease === RevlogEase.Again ? card.lapses + 1 : card.lapses,
      data: storeLeitnerState(card, newLeitnerState),
      left: 0, // Leitner doesn't use learning steps
    };
  }
}
