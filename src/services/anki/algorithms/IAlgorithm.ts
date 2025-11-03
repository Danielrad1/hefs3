/**
 * Core Algorithm Interface
 * Defines the contract for all scheduling algorithms (SM-2, FSRS, Leitner, AI)
 */

import { AnkiCard, RevlogEase, DeckConfig } from '../schema';

/**
 * Helper functions passed to algorithms
 */
export interface AlgorithmHelpers {
  /** Current time in seconds */
  nowSeconds: number;
  /** Collection creation time (for day calculations) */
  colCrt: number;
  /** Random number generator (0-1) */
  rng: () => number;
  /** Convert seconds offset to absolute seconds */
  addMinutes: (now: number, minutes: number) => number;
  /** Convert days offset to day number since collection creation */
  daysSinceCrt: (now: number) => number;
}

/**
 * Core algorithm interface
 * All scheduling algorithms must implement this
 */
export interface IAlgorithm {
  /**
   * Process an answer and return the updated card state
   * @param card - Current card state
   * @param ease - Answer button pressed (1=Again, 2=Hard, 3=Good, 4=Easy)
   * @param config - Deck configuration
   * @param helpers - Helper functions
   * @returns Partial card updates to apply
   */
  scheduleAnswer(
    card: AnkiCard,
    ease: RevlogEase,
    config: DeckConfig,
    helpers: AlgorithmHelpers
  ): Partial<AnkiCard>;

  /**
   * Optional: Initialize a new card when first introduced
   * Called when a card transitions from New to Learning
   * @param card - The new card
   * @param config - Deck configuration
   * @param helpers - Helper functions
   * @returns Partial card updates (e.g., FSRS initial stability/difficulty)
   */
  initNew?(
    card: AnkiCard,
    config: DeckConfig,
    helpers: AlgorithmHelpers
  ): Partial<AnkiCard>;

  /**
   * Algorithm identifier
   */
  readonly name: string;
}
