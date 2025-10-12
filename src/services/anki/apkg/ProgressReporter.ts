/**
 * Progress Reporter
 * Handles progress callback notifications during parsing
 */

import { ApkgParseOptions } from './types';

export class ProgressReporter {
  private onProgress?: (message: string) => void;

  constructor(options: ApkgParseOptions = {}) {
    this.onProgress = options.onProgress;
  }

  /**
   * Report progress to the UI
   * Safely handles errors in the callback
   */
  report(message: string): void {
    try {
      this.onProgress?.(message);
    } catch (error) {
      // Silently ignore callback errors to prevent parsing failures
      console.warn('[ProgressReporter] Error in progress callback:', error);
    }
  }
}
