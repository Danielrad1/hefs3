/**
 * AI service types - matching backend schema
 */

export type SourceType = 'prompt' | 'notes';
export type NoteModel = 'basic' | 'cloze';

export interface Style {
  format?: 'qna' | 'glossary' | 'term-def';
  strictJson?: boolean;
}

export interface GenerateDeckRequest {
  sourceType: SourceType;
  prompt?: string;
  notesText?: string;
  deckName?: string;
  noteModel?: NoteModel;
  itemLimit?: number;
  languageHints?: string[];
  style?: Style;
}

export interface GeneratedNote {
  front?: string;
  back?: string;
  cloze?: string;
  tags?: string[];
}

export interface GenerateDeckResponse {
  deckName: string;
  model: NoteModel;
  notes: GeneratedNote[];
  metadata: {
    modelUsed: string;
    items: number;
  };
}

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
 * AI Hints types
 */

export interface HintsInputItem {
  id: string;
  model: NoteModel;
  front?: string;
  back?: string;
  cloze?: string;
  tags?: string[];
  context?: string;
}

export interface HintsOptions {
  deckName?: string;
  languageHints?: string[];
  style?: 'concise' | 'mnemonic-heavy';
  maxItemsPerBatch?: number;
  
  // Advanced retrieval science features
  enableGradedHints?: boolean;
  hintLevel?: 'L1' | 'L2' | 'L3' | 'adaptive';
  enableEncodingMatch?: boolean;
  enableOverloadPenalty?: boolean;
  enableConfusableInference?: boolean;
  mnemonicGating?: 'off' | 'names-only' | 'l2-vocab-only' | 'on';
  enforceDistinctiveness?: boolean;
  strictLeakGuards?: boolean;
  
  // Scoring weights
  scoringWeights?: {
    discrimination?: number;
    specificity?: number;
    encodingMatch?: number;
    distinctiveness?: number;
    overloadPenalty?: number;
  };
}

export interface GenerateHintsRequest {
  items: HintsInputItem[];
  options?: HintsOptions;
}

export interface HintsOutputItem {
  id: string;
  // Multi-level hints for progressive disclosure
  hintL1: string; // Minimal - schema/constraint only (HTML)
  hintL2: string; // Constraint - add relational cue (HTML)
  hintL3: string; // Partial-info - more scaffolding (HTML, last resort)
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
    confusableContrast?: string;
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

export interface GenerateHintsResponse {
  items: HintsOutputItem[];
  metadata: {
    modelUsed: string;
    totalItems: number;
    successfulItems: number;
    averageScores?: {
      discrimination: number;
      specificity: number;
      encodingMatch: number;
      distinctiveness: number;
    };
  };
}
