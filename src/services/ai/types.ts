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
