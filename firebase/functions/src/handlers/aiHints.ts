import { Request, Response } from 'express';
import { GenerateHintsRequestSchema } from '../types/ai';
import { OpenAIProvider } from '../services/ai/OpenAIProvider';
import { AI_CONFIG } from '../config/ai';
import { logger } from '../utils/logger';

/**
 * Handler for AI hints generation endpoints
 */

/**
 * POST /ai/hints/generate
 * Generate hints and tips for flashcards
 */
export async function generateHints(req: Request, res: Response): Promise<void> {
  try {
    logger.info('[aiHints] Generate hints request:', {
      itemsCount: req.body?.items?.length || 0,
      deckName: req.body?.options?.deckName,
    });

    // Validate request
    const validationResult = GenerateHintsRequestSchema.safeParse(req.body);
    if (!validationResult.success) {
      logger.error('[aiHints] Validation failed:', validationResult.error.errors);
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Invalid request',
        },
      });
      return;
    }

    const request = validationResult.data;

    // Get API key from environment
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      logger.error('[aiHints] OpenAI API key not configured');
      res.status(500).json({
        success: false,
        error: {
          code: 'CONFIGURATION_ERROR',
          message: 'AI service not configured',
        },
      });
      return;
    }

    // Use default model from config (GPT-5 Nano 2025-08-07)
    const provider = new OpenAIProvider(apiKey, AI_CONFIG.defaultModel);
    
    logger.info('[aiHints] Starting generation with provider:', provider.getName());
    const response = await provider.generateHints(request);
    
    logger.info('[aiHints] Generation successful:', {
      totalItems: response.metadata.totalItems,
      successfulItems: response.metadata.successfulItems,
    });

    res.status(200).json({
      success: true,
      data: response,
    });
  } catch (error) {
    logger.error('[aiHints] Generate hints error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: {
        code: 'GENERATION_ERROR',
        message: errorMessage,
      },
    });
  }
}
