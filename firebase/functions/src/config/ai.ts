/**
 * AI Model Configuration
 * Change model settings here to apply across the entire application
 */

export const AI_CONFIG = {
  // Default model to use for deck generation
  defaultModel: 'gpt-5-nano-2025-08-07', // 400k tokens, $0.05/1M input
  
  // Available models with their capabilities
  models: [
    {
      id: 'gpt-5-nano-2025-08-07',
      name: 'GPT-5 Nano',
      provider: 'OpenAI',
      capabilities: {
        maxTokens: 400000,
        maxOutputTokens: 128000,
        supportsJson: true,
        supportsReasoning: true,
      },
      pricing: {
        inputPer1M: 0.05,
        cachedInputPer1M: 0.005,
        outputPer1M: 0.40,
      },
      description: 'Fastest, most cost-efficient version of GPT-5. Great for summarization and classification.',
    },
    {
      id: 'gpt-5-mini',
      name: 'GPT-5 Mini',
      provider: 'OpenAI',
      capabilities: {
        maxTokens: 400000,
        maxOutputTokens: 128000,
        supportsJson: true,
        supportsReasoning: true,
      },
      pricing: {
        inputPer1M: 0.25,
        outputPer1M: 2.00,
      },
      description: 'Balanced performance and cost.',
    },
    {
      id: 'gpt-5',
      name: 'GPT-5',
      provider: 'OpenAI',
      capabilities: {
        maxTokens: 400000,
        maxOutputTokens: 128000,
        supportsJson: true,
        supportsReasoning: true,
      },
      pricing: {
        inputPer1M: 1.25,
        outputPer1M: 5.00,
      },
      description: 'Most capable GPT-5 model.',
    },
    {
      id: 'gpt-4o',
      name: 'GPT-4o',
      provider: 'OpenAI',
      capabilities: {
        maxTokens: 128000,
        supportsJson: true,
      },
      pricing: {
        inputPer1M: 2.50,
        outputPer1M: 10.00,
      },
      description: 'Previous generation flagship model.',
    },
    {
      id: 'gpt-4o-mini',
      name: 'GPT-4o Mini',
      provider: 'OpenAI',
      capabilities: {
        maxTokens: 16000,
        supportsJson: true,
      },
      pricing: {
        inputPer1M: 0.15,
        outputPer1M: 0.60,
      },
      description: 'Previous generation cost-efficient model.',
    },
  ],
} as const;

export type ModelConfig = typeof AI_CONFIG.models[number];
