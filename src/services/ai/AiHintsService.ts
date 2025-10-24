import { ApiService } from '../cloud/ApiService';
import { GenerateHintsRequest, GenerateHintsResponse, HintsInputItem, HintsOutputItem, HintsOptions } from './types';
import { sanitizeHintsInput, getSkipReasonMessage, type SkippedItem } from './HintsSanitizer';
import { logger } from '../../utils/logger';

// Re-export for convenience
export { getSkipReasonMessage, type SkippedItem } from './HintsSanitizer';

export interface GenerateHintsResult {
  hints: HintsOutputItem[];
  skipped: SkippedItem[];
}

/**
 * Service for AI-powered hints and tips generation
 */
export class AiHintsService {
  /**
   * Generate hints and tips for cards
   * Automatically batches requests if items exceed max batch size
   * Returns both generated hints and skipped items with reasons
   */
  static async generateHintsForCards(
    items: HintsInputItem[],
    options?: HintsOptions
  ): Promise<GenerateHintsResult> {
    try {
      logger.info('[AiHintsService] Generating hints for', items.length, 'cards');

      // Sanitize inputs - strip HTML, validate content
      const { valid, skipped } = sanitizeHintsInput(items);
      
      if (valid.length === 0) {
        logger.warn('[AiHintsService] No valid items to process after sanitization');
        return { hints: [], skipped };
      }

      logger.info('[AiHintsService] Sanitization:', {
        total: items.length,
        valid: valid.length,
        skipped: skipped.length,
      });

      // Send all items to backend - it handles parallel processing internally
      logger.info('[AiHintsService] Sending', valid.length, 'items to backend for parallel processing');

      const request: GenerateHintsRequest = {
        items: valid,
        options,
      };

      const response = await ApiService.post<GenerateHintsResponse>('/ai/hints/generate', request);
      
      logger.info('[AiHintsService] ✅ Generation complete:', {
        requested: valid.length,
        received: response.items.length,
      });

      // Log full JSON payload for debugging
      logger.info('[AiHintsService] 📦 FULL JSON RESPONSE:');
      console.log(JSON.stringify(response, null, 2));

      const allResults = response.items;

      // Log first hint in detail to show structure
      if (allResults.length > 0) {
        logger.info('[AiHintsService] 🔍 SAMPLE HINT (first item):');
        console.log(JSON.stringify(allResults[0], null, 2));
      }

      logger.info('[AiHintsService] ✅ All hints generated:', {
        totalRequested: items.length,
        validProcessed: valid.length,
        hintsGenerated: allResults.length,
        skipped: skipped.length,
      });

      return { hints: allResults, skipped };
    } catch (error) {
      logger.error('[AiHintsService] Generate hints failed:', error);
      throw error;
    }
  }

  /**
   * Estimate cost for generating hints (approximate)
   * Based on typical token usage: ~150 input + ~50 output per card
   */
  static estimateCost(itemCount: number, modelId: string = 'gpt-4o-mini'): number {
    // GPT-4o-mini pricing: $0.150/1M input, $0.600/1M output
    const inputTokensPerCard = 150;
    const outputTokensPerCard = 50;

    const totalInputTokens = itemCount * inputTokensPerCard;
    const totalOutputTokens = itemCount * outputTokensPerCard;

    const inputCost = (totalInputTokens / 1_000_000) * 0.15;
    const outputCost = (totalOutputTokens / 1_000_000) * 0.6;

    return inputCost + outputCost;
  }
}
