/**
 * SM-2 Algorithm (Classic Anki)
 * Implements the SuperMemo-2 algorithm with Anki's extensions
 * (learning steps, graduating intervals, ease factor updates, fuzz, lapse handling)
 */

import {
  AnkiCard,
  RevlogEase,
  DeckConfig,
  CardType,
  CardQueue,
  MIN_EASE_FACTOR,
} from '../schema';
import { IAlgorithm, AlgorithmHelpers } from './IAlgorithm';

export class Sm2Algorithm implements IAlgorithm {
  readonly name = 'sm2';

  scheduleAnswer(
    card: AnkiCard,
    ease: RevlogEase,
    config: DeckConfig,
    helpers: AlgorithmHelpers
  ): Partial<AnkiCard> {
    // Delegate to type-specific handlers
    if (card.type === CardType.New) {
      return this.answerNew(card, ease, config, helpers);
    } else if (card.type === CardType.Learning) {
      return this.answerLearning(card, ease, config, helpers);
    } else if (card.type === CardType.Review) {
      return this.answerReview(card, ease, config, helpers);
    } else if (card.type === CardType.Relearning) {
      return this.answerRelearning(card, ease, config, helpers);
    }

    return {};
  }

  // ==========================================================================
  // NEW CARDS
  // ==========================================================================

  private answerNew(
    card: AnkiCard,
    ease: RevlogEase,
    config: DeckConfig,
    helpers: AlgorithmHelpers
  ): Partial<AnkiCard> {
    const delays = config.new.delays;

    if (ease === RevlogEase.Again) {
      // First learning step
      return {
        type: CardType.Learning,
        queue: CardQueue.Learning,
        due: helpers.addMinutes(helpers.nowSeconds, delays[0]),
        ivl: 0,
        factor: config.new.initialFactor,
        reps: card.reps + 1,
        left: this.setLeft(delays.length, delays.length),
      };
    } else if (ease === RevlogEase.Good || ease === RevlogEase.Hard) {
      // Good/Hard: Schedule first learning step (do not skip, do not graduate)
      // Anki behavior: Good on new card always enters learning at first step
      return {
        type: CardType.Learning,
        queue: CardQueue.Learning,
        due: helpers.addMinutes(helpers.nowSeconds, delays[0]),
        ivl: 0,
        factor: config.new.initialFactor,
        reps: card.reps + 1,
        left: this.setLeft(delays.length, delays.length), // Full steps remaining
      };
    } else if (ease === RevlogEase.Easy) {
      // Graduate with easy interval - apply interval modifier for global consistency
      const easyIvl = Math.max(1, Math.ceil(config.new.ints[1] * config.rev.ivlFct));
      return {
        type: CardType.Review,
        queue: CardQueue.Review,
        due: helpers.daysSinceCrt(helpers.nowSeconds) + easyIvl,
        ivl: easyIvl,
        factor: config.new.initialFactor + config.rev.ease4,
        reps: card.reps + 1,
        left: 0,
      };
    }

    return {};
  }

  // ==========================================================================
  // LEARNING CARDS
  // ==========================================================================

  private answerLearning(
    card: AnkiCard,
    ease: RevlogEase,
    config: DeckConfig,
    helpers: AlgorithmHelpers
  ): Partial<AnkiCard> {
    const delays = config.new.delays;
    const [repsLeft, stepsTotal] = this.getLeft(card.left);

    if (ease === RevlogEase.Again) {
      // Restart learning
      return {
        type: CardType.Learning,
        queue: CardQueue.Learning,
        due: helpers.addMinutes(helpers.nowSeconds, delays[0]),
        ivl: 0,
        reps: card.reps + 1,
        left: this.setLeft(stepsTotal, stepsTotal),
      };
    } else if (ease === RevlogEase.Good || ease === RevlogEase.Hard) {
      // Hard in learning acts as Good (Anki behavior)
      const currentStepIndex = stepsTotal - repsLeft;

      if (currentStepIndex + 1 < delays.length) {
        // Next learning step
        return {
          type: CardType.Learning,
          queue: CardQueue.Learning,
          due: helpers.addMinutes(helpers.nowSeconds, delays[currentStepIndex + 1]),
          ivl: 0,
          reps: card.reps + 1,
          left: this.setLeft(repsLeft - 1, stepsTotal),
        };
      } else {
        // Graduate - apply interval modifier for global consistency
        const graduatingIvl = Math.max(1, Math.ceil(config.new.ints[0] * config.rev.ivlFct));
        return {
          type: CardType.Review,
          queue: CardQueue.Review,
          due: helpers.daysSinceCrt(helpers.nowSeconds) + graduatingIvl,
          ivl: graduatingIvl,
          reps: card.reps + 1,
          left: 0,
        };
      }
    } else if (ease === RevlogEase.Easy) {
      // Graduate with easy interval - apply interval modifier for global consistency
      const easyIvl = Math.max(1, Math.ceil(config.new.ints[1] * config.rev.ivlFct));
      return {
        type: CardType.Review,
        queue: CardQueue.Review,
        due: helpers.daysSinceCrt(helpers.nowSeconds) + easyIvl,
        ivl: easyIvl,
        factor: card.factor + config.rev.ease4,
        reps: card.reps + 1,
        left: 0,
      };
    }

    return {};
  }

  // ==========================================================================
  // REVIEW CARDS
  // ==========================================================================

  private answerReview(
    card: AnkiCard,
    ease: RevlogEase,
    config: DeckConfig,
    helpers: AlgorithmHelpers
  ): Partial<AnkiCard> {
    if (ease === RevlogEase.Again) {
      // Lapse - go to relearning
      const newFactor = Math.max(MIN_EASE_FACTOR, card.factor - 200);

      return {
        type: CardType.Relearning,
        queue: CardQueue.Learning,
        due: helpers.addMinutes(helpers.nowSeconds, config.lapse.delays[0]),
        ivl: Math.max(1, Math.floor(card.ivl * config.lapse.mult)),
        factor: newFactor,
        reps: card.reps + 1,
        lapses: card.lapses + 1,
        left: this.setLeft(config.lapse.delays.length, config.lapse.delays.length),
      };
    } else {
      // Update ease factor
      let newFactor = card.factor;

      if (ease === RevlogEase.Hard) {
        newFactor = Math.max(MIN_EASE_FACTOR, card.factor - 150);
      } else if (ease === RevlogEase.Easy) {
        newFactor = card.factor + config.rev.ease4;
      }

      // Calculate new interval
      let newIvl: number;
      const fct = card.factor / 1000;

      if (ease === RevlogEase.Hard) {
        newIvl = Math.ceil(card.ivl * 1.2 * config.rev.ivlFct);
      } else if (ease === RevlogEase.Good) {
        newIvl = Math.ceil(card.ivl * fct * config.rev.ivlFct);
      } else if (ease === RevlogEase.Easy) {
        newIvl = Math.ceil(card.ivl * fct * config.rev.ivlFct * 1.3);
      } else {
        newIvl = card.ivl;
      }

      // Apply fuzz and cap
      newIvl = this.applyFuzz(newIvl, config.rev.fuzz, helpers.rng);
      newIvl = Math.min(newIvl, config.rev.maxIvl);
      newIvl = Math.max(newIvl, card.ivl + 1); // Ensure growth

      return {
        type: CardType.Review,
        queue: CardQueue.Review,
        due: helpers.daysSinceCrt(helpers.nowSeconds) + newIvl,
        ivl: newIvl,
        factor: newFactor,
        reps: card.reps + 1,
      };
    }
  }

  // ==========================================================================
  // RELEARNING CARDS
  // ==========================================================================

  private answerRelearning(
    card: AnkiCard,
    ease: RevlogEase,
    config: DeckConfig,
    helpers: AlgorithmHelpers
  ): Partial<AnkiCard> {
    const delays = config.lapse.delays;
    const [repsLeft, stepsTotal] = this.getLeft(card.left);

    if (ease === RevlogEase.Again) {
      // Restart relearning
      return {
        type: CardType.Relearning,
        queue: CardQueue.Learning,
        due: helpers.addMinutes(helpers.nowSeconds, delays[0]),
        reps: card.reps + 1,
        left: this.setLeft(stepsTotal, stepsTotal),
      };
    } else {
      const currentStepIndex = stepsTotal - repsLeft;

      if (currentStepIndex + 1 < delays.length) {
        // Next relearning step
        return {
          type: CardType.Relearning,
          queue: CardQueue.Learning,
          due: helpers.addMinutes(helpers.nowSeconds, delays[currentStepIndex + 1]),
          reps: card.reps + 1,
          left: this.setLeft(repsLeft - 1, stepsTotal),
        };
      } else {
        // Graduate back to review - apply interval modifier
        const baseIvl = Math.max(config.lapse.minInt, card.ivl);
        const newIvl = Math.max(1, Math.ceil(baseIvl * config.rev.ivlFct));

        return {
          type: CardType.Review,
          queue: CardQueue.Review,
          due: helpers.daysSinceCrt(helpers.nowSeconds) + newIvl,
          ivl: newIvl,
          reps: card.reps + 1,
          left: 0,
        };
      }
    }
  }

  // ==========================================================================
  // UTILITIES
  // ==========================================================================

  /**
   * Encode left field: a*1000+b where a=reps left, b=steps total
   */
  private setLeft(repsLeft: number, stepsTotal: number): number {
    return repsLeft * 1000 + stepsTotal;
  }

  /**
   * Decode left field: returns [repsLeft, stepsTotal]
   */
  private getLeft(left: number): [number, number] {
    const repsLeft = Math.floor(left / 1000);
    const stepsTotal = left % 1000;
    return [repsLeft, stepsTotal];
  }

  /**
   * Apply fuzz to interval (±5%)
   */
  private applyFuzz(ivl: number, fuzzFactor: number, rng: () => number): number {
    if (ivl < 2) return ivl;

    const fuzz = Math.floor(ivl * fuzzFactor);
    const minIvl = ivl - fuzz;
    const maxIvl = ivl + fuzz;

    // Random between min and max
    return Math.floor(rng() * (maxIvl - minIvl + 1) + minIvl);
  }
}
