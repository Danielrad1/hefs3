/**
 * Utility functions for building AI generation prompts from multiple sources
 */

export interface FileAttachment {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  uri: string;
  parsedText?: string;
}

export interface InstructionOptions {
  cardFormat: 'basic' | 'cloze';
  detailLevel: 'low' | 'medium' | 'high';
  tone: 'concise' | 'comprehensive' | 'exam';
  formatting: string[]; // e.g., ['bold_key_terms', 'lists', 'code', 'math']
  chunking: {
    strategy: 'by_heading' | 'by_paragraph' | 'auto';
    maxCardsPerSection?: number;
    minChars?: number;
  };
  templates?: {
    frontTemplate?: string;
    backTemplate?: string;
    clozeTemplate?: string;
  };
  tags?: string[];
  languageHints?: string[];
  examples?: Array<{
    front?: string;
    back?: string;
    cloze?: string;
  }>;
}

/**
 * Compose a complete notesText string from attachments and instructions
 * This is used for AI generation without storing files
 */
export function composeNotesTextFromAttachments(
  attachments: FileAttachment[],
  instructions: InstructionOptions,
  itemLimit: number
): string {
  const sections: string[] = [];

  // 1. SOURCE: Files section
  if (attachments.length > 0) {
    sections.push(`SOURCE: Files`);
    sections.push('');
    
    attachments.forEach((file, index) => {
      sections.push(`===== FILE ${index + 1}: ${file.name} (${file.mimeType}) =====`);
      if (file.parsedText) {
        sections.push(file.parsedText);
      }
      sections.push('');
    });
  }

  // 2. INSTRUCTIONS section
  sections.push(`INSTRUCTIONS:`);
  sections.push('');
  
  // Card format
  sections.push(`Card format: ${instructions.cardFormat === 'basic' ? 'Basic (Front & Back)' : 'Cloze (Fill-in-Blank)'}`);
  
  // Detail level
  const detailDescriptions = {
    low: 'Low - Key facts only',
    medium: 'Medium - Balanced depth',
    high: 'High - Comprehensive coverage',
  };
  sections.push(`Detail level: ${detailDescriptions[instructions.detailLevel]}`);
  
  // Tone
  const toneDescriptions = {
    concise: 'Concise - Brief and to the point',
    comprehensive: 'Comprehensive - Thorough explanations',
    exam: 'Exam-focused - Emphasize testable facts',
  };
  sections.push(`Tone: ${toneDescriptions[instructions.tone]}`);
  
  // Formatting preferences
  if (instructions.formatting.length > 0) {
    sections.push(`Formatting: ${instructions.formatting.join(', ')}`);
  }
  
  // Chunking strategy
  const chunkingDescriptions = {
    by_heading: 'Create cards based on document headings/sections',
    by_paragraph: 'Create cards from individual paragraphs',
    auto: 'Automatically determine optimal chunking',
  };
  sections.push(`Chunking strategy: ${chunkingDescriptions[instructions.chunking.strategy]}`);
  
  if (instructions.chunking.maxCardsPerSection) {
    sections.push(`Maximum cards per section: ${instructions.chunking.maxCardsPerSection}`);
  }
  
  if (instructions.chunking.minChars) {
    sections.push(`Minimum characters for coverage: ${instructions.chunking.minChars}`);
  }
  
  // Templates
  if (instructions.templates) {
    if (instructions.templates.frontTemplate) {
      sections.push(`Front template: ${instructions.templates.frontTemplate}`);
    }
    if (instructions.templates.backTemplate) {
      sections.push(`Back template: ${instructions.templates.backTemplate}`);
    }
    if (instructions.templates.clozeTemplate) {
      sections.push(`Cloze template: ${instructions.templates.clozeTemplate}`);
    }
  }
  
  // Tags
  if (instructions.tags && instructions.tags.length > 0) {
    sections.push(`Default tags: ${instructions.tags.join(', ')}`);
  }
  
  // Language hints
  if (instructions.languageHints && instructions.languageHints.length > 0) {
    sections.push(`Language hints: ${instructions.languageHints.join(', ')}`);
  }
  
  // Examples (few-shot learning)
  if (instructions.examples && instructions.examples.length > 0) {
    sections.push('');
    sections.push(`Example cards for style reference:`);
    instructions.examples.forEach((example, idx) => {
      sections.push(`Example ${idx + 1}:`);
      if (example.front) {
        sections.push(`  Front: ${example.front}`);
      }
      if (example.back) {
        sections.push(`  Back: ${example.back}`);
      }
      if (example.cloze) {
        sections.push(`  Cloze: ${example.cloze}`);
      }
    });
  }

  return sections.join('\n');
}

/**
 * Calculate total character count from attachments
 */
export function getTotalCharacterCount(attachments: FileAttachment[]): number {
  return attachments.reduce((total, file) => {
    return total + (file.parsedText?.length || 0);
  }, 0);
}

/**
 * Get file icon name based on mime type
 */
export function getFileIconName(mimeType: string, fileName: string): keyof typeof import('@expo/vector-icons').Ionicons.glyphMap {
  if (mimeType === 'application/pdf' || fileName.endsWith('.pdf')) {
    return 'document-text';
  }
  if (mimeType.includes('wordprocessingml') || fileName.endsWith('.docx')) {
    return 'document-attach';
  }
  if (mimeType === 'text/plain' || fileName.endsWith('.txt')) {
    return 'document-text-outline';
  }
  return 'document';
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes?: number): string {
  if (!bytes) return 'Unknown size';
  
  if (bytes < 1024) {
    return `${bytes} B`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  } else {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}

/**
 * Default instruction options
 */
export function getDefaultInstructions(): InstructionOptions {
  return {
    cardFormat: 'basic',
    detailLevel: 'medium',
    tone: 'concise',
    formatting: ['bold_key_terms'],
    chunking: {
      strategy: 'auto',
    },
    tags: [],
    languageHints: [],
    examples: [],
  };
}
