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
