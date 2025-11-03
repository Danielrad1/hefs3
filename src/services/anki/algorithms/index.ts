/**
 * Algorithm exports
 * Central registry for all scheduling algorithms
 */

export { IAlgorithm, AlgorithmHelpers } from './IAlgorithm';
export { Sm2Algorithm } from './Sm2Algorithm';
export { FsrsAlgorithm } from './FsrsAlgorithm';
export { LeitnerAlgorithm } from './LeitnerAlgorithm';

import { IAlgorithm } from './IAlgorithm';
import { Sm2Algorithm } from './Sm2Algorithm';
import { FsrsAlgorithm } from './FsrsAlgorithm';
import { LeitnerAlgorithm } from './LeitnerAlgorithm';
import { DeckConfig } from '../schema';

/**
 * Algorithm type identifiers
 */
export type AlgorithmType = 'sm2' | 'fsrs' | 'leitner' | 'ai';

/**
 * Get algorithm instance based on deck config
 * @param config - Deck configuration with algo field
 * @returns Algorithm instance (defaults to SM-2)
 */
export function selectAlgorithm(config: DeckConfig): IAlgorithm {
  const algo = (config as any).algo as AlgorithmType | undefined;

  switch (algo) {
    case 'fsrs':
      return new FsrsAlgorithm();
    case 'leitner':
      return new LeitnerAlgorithm();
    case 'ai':
      // AI mode uses FSRS under the hood with auto-tuned parameters
      return new FsrsAlgorithm();
    case 'sm2':
    default:
      // Default to SM-2 for backward compatibility
      return new Sm2Algorithm();
  }
}
