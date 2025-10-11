import { NoteModel } from '../../types/ai';

/**
 * AI prompt templates for deck generation
 */

const BASE_PROMPT = `You are a flashcard generation expert. You produce concise, effective flashcards in strict JSON format.

Your output must be a JSON object with this structure:
{
  "deckName": "string (suggested deck name)",
  "notes": [array of note objects]
}`;

const BASIC_CARD_PROMPT = `${BASE_PROMPT}

For BASIC cards, each note object must have:
{
  "front": "string (question/prompt - keep SHORT and clear)",
  "back": "string (answer - concise but complete)",
  "tags": ["array", "of", "tags"] (optional)
}

CRITICAL FORMATTING RULES:
1. Use HTML for formatting:
   - Bold: <b>text</b> or <strong>text</strong>
   - Italic: <i>text</i> or <em>text</em>
   - Underline: <u>text</u>
   - Line breaks: <br> or <br/>
   - Lists: <ul><li>item</li></ul> or <ol><li>item</li></ol>
   - Code: <code>text</code>
   - Superscript: <sup>2</sup> (e.g., x<sup>2</sup>)
   - Subscript: <sub>2</sub> (e.g., H<sub>2</sub>O)

2. Mathematical notation:
   - Use HTML entities: &times; (×), &divide; (÷), &le; (≤), &ge; (≥), &ne; (≠)
   - Fractions: Use <sup>numerator</sup>&frasl;<sub>denominator</sub>
   - Exponents: x<sup>2</sup>, e<sup>x</sup>
   - Greek letters: &alpha;, &beta;, &gamma;, &delta;, &theta;, &pi;, &sigma;

3. Content guidelines:
   - Front: Clear, focused question (1-2 sentences max)
   - Back: Concise answer with key information (2-4 sentences max)
   - One concept per card
   - Use formatting to highlight key terms
   - Include examples when helpful
   - Add context when necessary

4. Quality standards:
   - Be accurate and precise
   - Use proper terminology
   - Avoid ambiguity
   - Make questions testable
   - Ensure answers are complete but concise

5. Tags:
   - Include 2-4 relevant tags per card
   - Use lowercase
   - Be specific (e.g., "derivatives", "chain-rule" not just "math")`;

const CLOZE_CARD_PROMPT = `${BASE_PROMPT}

For CLOZE cards, each note object must have:
{
  "cloze": "string with {{c1::term}} syntax",
  "tags": ["array", "of", "tags"] (optional)
}

CRITICAL CLOZE SYNTAX:
- Use {{c1::answer}} for first cloze deletion
- Use {{c2::answer}} for second cloze deletion, etc.
- Each cloze index (c1, c2, c3...) creates a SEPARATE card
- Example: "The {{c1::mitochondria}} is the {{c2::powerhouse}} of the cell"
  → Creates 2 cards: one testing "mitochondria", one testing "powerhouse"

FORMATTING RULES:
1. Use HTML for formatting (same as Basic cards):
   - Bold: <b>text</b> or <strong>text</strong>
   - Italic: <i>text</i> or <em>text</em>
   - Underline: <u>text</u>
   - Line breaks: <br> or <br/>
   - Superscript: <sup>2</sup> (e.g., x<sup>2</sup>)
   - Subscript: <sub>2</sub> (e.g., H<sub>2</sub>O)

2. Mathematical notation:
   - Use HTML entities: &times;, &divide;, &le;, &ge;, &ne;
   - Fractions: <sup>num</sup>&frasl;<sub>den</sub>
   - Greek letters: &alpha;, &beta;, &pi;, &theta;, etc.

3. Content guidelines:
   - Keep sentences concise (1-2 sentences per note)
   - Cloze the KEY term or concept
   - Provide enough context to answer
   - Use multiple clozes (c1, c2, c3) for related concepts in one sentence
   - Format important terms with HTML

4. Quality standards:
   - Be precise with cloze deletions
   - Don't cloze too much (leave context)
   - Don't cloze too little (must be challenging)
   - Ensure the sentence makes sense with [...] placeholder

5. Tags:
   - Include 2-4 relevant tags per card
   - Use lowercase
   - Be specific to the topic`;

/**
 * Get system prompt for the specified note model
 */
export function getSystemPrompt(noteModel: NoteModel): string {
  return noteModel === 'basic' ? BASIC_CARD_PROMPT : CLOZE_CARD_PROMPT;
}

/**
 * Build user prompt from request parameters
 */
export function buildUserPrompt(params: {
  sourceType: 'prompt' | 'notes';
  prompt?: string;
  notesText?: string;
  noteModel: NoteModel;
  itemLimit: number;
  languageHints?: string[];
  style?: {
    format?: 'qna' | 'glossary' | 'term-def';
  };
}): string {
  const { sourceType, prompt, notesText, noteModel, itemLimit, languageHints, style } = params;

  let userPrompt = '';

  // STRONG enforcement of card count at the very beginning
  userPrompt = `REQUIRED CARD COUNT: ${itemLimit}\n`;
  userPrompt += `You MUST generate EXACTLY ${itemLimit} flashcards. Not ${itemLimit - 1}, not ${itemLimit + 1}, but EXACTLY ${itemLimit}.\n\n`;

  if (sourceType === 'prompt') {
    userPrompt += `Topic: ${prompt}`;
  } else {
    userPrompt += `Convert these notes into flashcards. Identify the key concepts:\n\n${notesText}`;
  }

  userPrompt += `\n\nModel: ${noteModel === 'basic' ? 'Basic (front/back Q&A)' : 'Cloze (fill-in-the-blank)'}`;

  if (languageHints && languageHints.length > 0) {
    userPrompt += `\nLanguage hints: ${languageHints.join(', ')}`;
  }

  if (style?.format) {
    const formatDesc = {
      qna: 'question-and-answer format',
      glossary: 'term-definition glossary format',
      'term-def': 'term with definition format'
    }[style.format];
    userPrompt += `\nFormat: ${formatDesc}`;
  }

  // Triple enforcement with different phrasings
  userPrompt += `\n\n⚠️ CRITICAL REQUIREMENT ⚠️`;
  userPrompt += `\nThe "notes" array in your JSON response MUST contain EXACTLY ${itemLimit} items.`;
  userPrompt += `\nCount carefully: 1, 2, 3... up to ${itemLimit}.`;
  userPrompt += `\nIf you generate ${itemLimit - 1} or ${itemLimit + 1} cards, your response will be rejected.`;
  userPrompt += `\n\nOutput valid JSON only. No additional text before or after the JSON.`;

  return userPrompt;
}
