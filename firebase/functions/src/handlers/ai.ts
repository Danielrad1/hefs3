import { Request, Response } from 'express';
import { GenerateDeckRequestSchema, ModelInfo } from '../types/ai';
import { OpenAIProvider } from '../services/ai/OpenAIProvider';
import { AI_CONFIG } from '../config/ai';
import { logger } from '../utils/logger';

/**
 * POST /ai/deck/generate
 * Generate a deck from natural language prompt or notes
 */
export const generateDeck = async (req: Request, res: Response) => {
  try {
    // Validate request
    const validation = GenerateDeckRequestSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: validation.error.errors[0]?.message || 'Invalid request',
        },
      });
    }

    const request = validation.data;

    // Get API key from environment
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      logger.error('[AI] OPENAI_API_KEY environment variable not configured');
      return res.status(500).json({
        success: false,
        error: {
          code: 'CONFIGURATION_ERROR',
          message: 'AI service not configured',
        },
      });
    }

    // Create provider and generate
    const provider = new OpenAIProvider(apiKey);
    const result = await provider.generateDeck(request);

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('[AI] Generate deck error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'GENERATION_FAILED',
        message: error instanceof Error ? error.message : 'Failed to generate deck',
      },
    });
  }
};

/**
 * GET /ai/models
 * Get available AI models and their capabilities
 */
export const getModels = async (req: Request, res: Response) => {
  // Convert config models to API response format
  const models: ModelInfo[] = AI_CONFIG.models.map(model => ({
    id: model.id,
    name: model.name,
    provider: model.provider,
    capabilities: {
      maxTokens: model.capabilities.maxTokens,
      supportsJson: model.capabilities.supportsJson,
    },
  }));

  return res.json({
    success: true,
    data: models,
  });
};

export const aiHandler = {
  generateDeck,
  getModels,
};
