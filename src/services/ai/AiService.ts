import { ApiService } from '../cloud/ApiService';
import { GenerateDeckRequest, GenerateDeckResponse, ModelInfo } from './types';
import { logger } from '../../utils/logger';

/**
 * Service for AI-powered deck generation
 */
export class AiService {
  /**
   * Generate a deck from a prompt or notes
   */
  static async generateDeck(request: GenerateDeckRequest): Promise<GenerateDeckResponse> {
    try {
      logger.info('[AiService] Generating deck:', request);
      const response = await ApiService.post<GenerateDeckResponse>('/ai/deck/generate', request);
      logger.info('[AiService] Generated deck:', response.deckName, response.notes.length, 'notes');
      return response;
    } catch (error) {
      logger.error('[AiService] Generate deck failed:', error);
      throw error;
    }
  }

  /**
   * Get available AI models
   */
  static async getModels(): Promise<ModelInfo[]> {
    try {
      const response = await ApiService.get<ModelInfo[]>('/ai/models');
      return response;
    } catch (error) {
      logger.error('[AiService] Get models failed:', error);
      return [];
    }
  }
}
