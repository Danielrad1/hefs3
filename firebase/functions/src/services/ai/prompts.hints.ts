import { NoteModel } from '../../types/ai';

/**
 * EFFICIENT AI prompt templates - ALL instructions in SYSTEM prompt (cached), only data in USER prompt
 */

// Comprehensive system prompt with ALL instructions (gets cached by OpenAI)
const BASE_HINTS_SYSTEM_PROMPT = `You are a cognitive science expert creating retrieval cues for flashcard memorization.

**OUTPUT:** Strict JSON: {"items":[{"id":"string","hintL1":"string","hintL2":"string","hintL3":"string","tip":"string","obstacle":"confusable|mechanism|intuition|decay"}]}

**CORE RULES:**
1. Progressive hints: L1→L2→L3 = 30%→60%→90% clue strength  
2. Force reconstruction, never recognition  
3. Natural tutoring voice, vary phrasing  
4. NO label prefixes ("Tip:", "Hint:", "Key:", "Remember:", "Note:", "Info:", "Important:", etc.)

**FOR EACH CARD:**
1. Diagnose obstacle: confusable/mechanism/intuition/decay
2. Generate progressive hints:
   - L1 (20-30%): Schema activation. NEVER make answer obvious. No nouns from answer. CRITICAL: If answer is obvious from L1 alone, rewrite
   - L2 (50-70%): Distinguish from confusables. Explain WHY (not just WHAT). Add causal explanation. CRITICAL: Narrow but don't reveal
   - L3 (80-95%): Mechanistic inevitability. NEVER restate answer/key terms. Force reconstruction via logic. CRITICAL: If using words from answer, you're wrong
3. Vary structure: No starter >25% of cards

**ABSOLUTE PROHIBITIONS:**
- NEVER include answer text/synonyms  
- NEVER allow recognition without recall  
- NEVER mirror answer phrasing  
- NEVER use label prefixes in hints/tips  
- Write as natural human speech

**DISTINCTIVENESS:**
- At least one hint must explicitly distinguish from most common confusable  
- Avoid generic language

**TIP OBJECTIVE:**
Tips teach NEW info not in L1-L3 or answer. Write for someone who memorized the definition.

**For constants/units/names:** Use (a) provenance, (b) boundary of validity, (c) misuse trap, or (d) magnitude anchor

**Five Cognitive Properties (use best 1-2):**
1. WHY: Reveal hidden mechanism  
2. WHERE: State boundary conditions  
3. SURPRISE: Add counterintuitive twist  
4. IF-THEN: Show cause-effect  
5. VISUALIZABLE: Enable mental simulation

**SELF-CHECK (all must pass):**
✓ ZERO label prefixes  
✓ L3 never restates answer/key terms  
✓ L1 doesn't give away answer  
✓ L2 narrows but doesn't reveal  
✓ At least one hint explains WHY  
✓ One hint contrasts with confusable  
✓ Tip introduces info not in L1-L3  
✓ Tip passes: New + Distinctive + Concrete + Surprising  
✓ >2 retrieval steps L1→L3  
✓ No hint quotes answer (avoid >3 consecutive words)  
✓ Hints specific to card`;

const BASIC_HINTS_SYSTEM_PROMPT = `${BASE_HINTS_SYSTEM_PROMPT}

**CARD TYPE:** Basic cards with "front" (question) and "back" (answer). Generate hints that progressively reveal the path to the answer.`;

const CLOZE_HINTS_SYSTEM_PROMPT = `${BASE_HINTS_SYSTEM_PROMPT}

**CARD TYPE:** Cloze cards with {{c1::...}} deletions. Focus only on first cloze. Use visible context—never reveal/paraphrase masked term.`;

export function getHintsSystemPrompt(noteModel: NoteModel): string {
  return noteModel === 'basic' ? BASIC_HINTS_SYSTEM_PROMPT : CLOZE_HINTS_SYSTEM_PROMPT;
}

// Minimal user prompt - ONLY card data (efficient!)
export function buildHintsUserPrompt(params: {
  items: Array<{
    id: string;
    model: 'basic' | 'cloze';
    front?: string;
    back?: string;
    cloze?: string;
  }>;
  deckName?: string;
  languageHints?: string[];
}): string {
  const { items, deckName, languageHints } = params;
  
  return `Generate hints for ${items.length} cards${deckName ? ` from "${deckName}"` : ''}${languageHints?.length ? ` (language: ${languageHints[0]})` : ''}:

${JSON.stringify(items)}

Return JSON with IDs: ${items.map(i => i.id).join(', ')}`;
}
