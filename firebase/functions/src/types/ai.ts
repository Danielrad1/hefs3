import { z } from 'zod';

/**
 * AI deck generation request/response types
 */

// Source type for generation
export type SourceType = 'prompt' | 'notes';

// Note model type
export type NoteModel = 'basic' | 'cloze';

// Style options
export const StyleSchema = z.object({
  format: z.enum(['qna', 'glossary', 'term-def']).optional(),
  strictJson: z.boolean().optional(),
});

export type Style = z.infer<typeof StyleSchema>;

// Request schema
export const GenerateDeckRequestSchema = z.object({
  sourceType: z.enum(['prompt', 'notes']),
  prompt: z.string().optional(),
  notesText: z.string().optional(),
  deckName: z.string().optional(),
  noteModel: z.enum(['basic', 'cloze']).default('basic'),
  itemLimit: z.number().min(1).max(1000).optional().default(50),
  languageHints: z.array(z.string()).optional(),
  style: StyleSchema.optional(),
}).refine(
  (data) => (data.sourceType === 'prompt' && data.prompt) || (data.sourceType === 'notes' && data.notesText),
  { message: 'Must provide either prompt or notesText based on sourceType' }
);

export type GenerateDeckRequest = z.infer<typeof GenerateDeckRequestSchema>;

// Note in response
export interface GeneratedNote {
  front?: string;
  back?: string;
  cloze?: string;
  tags?: string[];
}

// Response schema
export interface GenerateDeckResponse {
  deckName: string;
  model: NoteModel;
  notes: GeneratedNote[];
  metadata: {
    modelUsed: string;
    items: number;
  };
}

// AI Provider interface
export interface AIProvider {
  generateDeck(request: GenerateDeckRequest): Promise<GenerateDeckResponse>;
  getName(): string;
}

// Available models info
export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  capabilities: {
    maxTokens: number;
    supportsJson: boolean;
  };
}

/**
 * AI hints generation request/response types
 */

// Input item for hints generation
export interface HintsInputItem {
  id: string;
  model: NoteModel;
  front?: string;
  back?: string;
  cloze?: string;
}

// Options for hints generation
export const HintsOptionsSchema = z.object({
  deckName: z.string().optional(),
  languageHints: z.array(z.string()).optional(),
  style: z.enum(['concise', 'mnemonic-heavy']).optional().default('concise'),
  maxItemsPerBatch: z.number().min(1).max(100).optional().default(50),
  modelTier: z.enum(['basic', 'advanced']).optional().default('basic'), // Model tier selection (basic = nano, advanced = mini)
  
  // Advanced retrieval science features
  enableGradedHints: z.boolean().optional().default(true),
  hintLevel: z.enum(['L1', 'L2', 'L3', 'adaptive']).optional().default('adaptive'),
  enableEncodingMatch: z.boolean().optional().default(true),
  enableOverloadPenalty: z.boolean().optional().default(true),
  enableConfusableInference: z.boolean().optional().default(true),
  mnemonicGating: z.enum(['off', 'names-only', 'l2-vocab-only', 'on']).optional().default('names-only'),
  enforceDistinctiveness: z.boolean().optional().default(true),
  strictLeakGuards: z.boolean().optional().default(true),
  
  // Scoring weights (must sum to ~1.0)
  scoringWeights: z.object({
    discrimination: z.number().min(0).max(1).optional().default(0.4),
    specificity: z.number().min(0).max(1).optional().default(0.3),
    encodingMatch: z.number().min(0).max(1).optional().default(0.2),
    distinctiveness: z.number().min(0).max(1).optional().default(0.1),
    overloadPenalty: z.number().min(-1).max(0).optional().default(-0.15),
  }).optional(),
});

export type HintsOptions = z.infer<typeof HintsOptionsSchema>;

// Request schema for hints generation
export const GenerateHintsRequestSchema = z.object({
  items: z.array(z.object({
    id: z.string(),
    model: z.enum(['basic', 'cloze']),
    front: z.string().optional(),
    back: z.string().optional(),
    cloze: z.string().optional(),
    // Optional metadata for better hint generation
    tags: z.array(z.string()).optional(),
    context: z.string().optional(), // Additional context about the item
  })).min(1).max(10000), // Support large decks - backend handles parallelization
  options: HintsOptionsSchema.optional(),
});

export type GenerateHintsRequest = z.infer<typeof GenerateHintsRequestSchema>;

// Output item from hints generation (enhanced with multi-level hints)
export interface HintsOutputItem {
  id: string;
  // Multi-level hints for progressive disclosure
  hintL1: string; // Minimal - schema/constraint only
  hintL2: string; // Constraint - add relational cue
  hintL3: string; // Partial-info - more scaffolding (last resort)
  tip: string;    // Post-reveal elaboration (HTML formatted)
  // Why explanations (memory mechanics rationale)
  whyL1?: string; // Why L1 helps (one sentence)
  whyL2?: string; // Why L2 helps (one sentence)
  whyL3?: string; // Why L3 helps (one sentence)
  whyTip?: string; // Why tip helps (one sentence)
  obstacle?: 'confusable' | 'mechanism' | 'intuition' | 'decay'; // Diagnosed retrieval obstacle
  // Optional metadata for debugging/analysis
  metadata?: {
    tipType?: 'mechanism' | 'structure' | 'concrete-to-rule' | 'mnemonic';
    confusableContrast?: string; // What it was contrasted against
    scores?: {
      l1Score: number;
      l2Score: number;
      l3Score: number;
      discrimination: number;
      specificity: number;
      encodingMatch: number;
      distinctiveness: number;
      overloadPenalty: number;
    };
  };
}

// Response for hints generation
export interface GenerateHintsResponse {
  items: HintsOutputItem[];
  metadata: {
    modelUsed: string;
    totalItems: number;
    successfulItems: number;
    totalTimeSeconds?: number;
    totalCost?: number;
    reasoningEffort?: string;
    averageScores?: {
      discrimination: number;
      specificity: number;
      encodingMatch: number;
      distinctiveness: number;
    };
  };
}

// Extend AI Provider interface
export interface AIProvider {
  generateDeck(request: GenerateDeckRequest): Promise<GenerateDeckResponse>;
  generateHints?(request: GenerateHintsRequest): Promise<GenerateHintsResponse>;
  getName(): string;
}
