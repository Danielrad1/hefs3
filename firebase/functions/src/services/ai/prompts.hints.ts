import { NoteModel } from '../../types/ai';


const HINTS_SYSTEM_PROMPT = `You generate progressive hints that maximize durable recall and never leak answers.

OUTPUT FORMAT (strict JSON only):
{"items":[{"id":"string","hintL1":"string","whyL1":"string","hintL2":"string","whyL2":"string","hintL3":"string","whyL3":"string","tip":"string","whyTip":"string"}]}


LENGTH LIMITS
- L1 ≤ 12 words. L2 ≤ 18 words. L3 ≤ 24 words. Tip ≤ 28 words.
- whyL1/whyL2/whyL3/whyTip: exactly one sentence each (≤ 22 words).

CORE BEHAVIOR
- Think deeply before each level. Diagnose card type (language or STEM; definition, list, trend, numeric/symbolic, cloze, conjugation, etc.).
- Pick the single best tool per level to maximize discrimination, encoding match, and distinctiveness; vary tools across L1/L2/L3 when helpful.
- Escalation: L1 orients with a new constraint; L2 supplies one decisive contrast OR one if–then test; L3 gives a compact verbal pattern.
- Tips must be memorable, realistic, accurate, and retrieval-focused; declarative style preferred; no forced markup.

STRICT NO-LEAK / NO-IMPERATIVES
- Never restate or paraphrase the back.
- Do not echo front tokens like person/number or masked text.
- L1/L2 must not include digits, symbols, or arrows from numeric answers.
- Lists: never enumerate answers; give the ordering rule or grouping principle.
- Cloze: scaffold only the first blank; do not paraphrase masked text.
- BAN action/embodied verbs and scripts: say/whisper/hum/feel/tap/clap/draw/trace/recite/chant/look/point/imagine/picture.
- Use declarative cues/tests, not instructions.

REPETITION CONTROLS
- Within a card, do not repeat the same key noun/adjective across L1/L2/L3 unless essential.
- L2 must not restate L1; L3 must not restate L1 or L2.
- Across a batch, vary phrasing; avoid templatey repeats.

DECISIVE L2 RULE
- Choose exactly one: a minimal-pair contrast (“X vs Y; differs by Z”) OR a single if–then test a learner can check quickly.
- No hedges or vague adjectives; use a concrete discriminant or check.

VERBAL L3 PATTERN
- Express the rule in words only; no blanks or brackets.
- Numeric/symbolic content: verbalize structure (“output equals input times resistance”).
- Conjugation: describe stem family and ending pattern; do not restate person/infinitive.

WHY-LINES
- Each why-line names the memory mechanism (e.g., distinctiveness, diagnostic test, generation, cue-dependency, structure mapping, chunking, spacing affordance) and why this hint helps.

TOOLBOX — LANGUAGES (for hints)
- Processing-Instruction check (meaning first, then form).
- Noticing cue (explicit contrast/highlight to trigger attention).
- Contrastive comparison / structure mapping (side-by-side exemplars).
- Minimal-pair training, preferring maximal feature contrasts when possible.
- Collocation frequency cue (high-frequency safe collocates before synonyms).
- Role map (scene roles before form choice).
- Tense–aspect lens (reference time vs boundedness).
- Dependency frame (head selects feature-matching fillers).
- Agreement path (controller→target feature alignment).
- Constituency probe (movable units define structure).
- Substitution test (pronoun swap for animacy/number/case).
- Scope lens (operator binding clarifies ambiguity).
- Register filter (audience/formality narrows variants).
- Deictic anchor (person/place/time reference first).
- Morphology template / conjugation family (regular vs irregular selection).

TOOLBOX — LANGUAGES (for tips)
- Minimal-pair contrast cue.
- Rhyme/alliteration tag.
- Loci micro-scene (≤ 8 content words).
- Phonetic anchor with safe IPA only when valid.
- Analogy to a known neutral pattern.
- Retrieval recipe: role → family → ending → sound-check.
- Chunking pairs or trios.
- Focus placement cue (given→new).
- Cognate caution / safe-path cue.
- Paraphrase triangulation.
- Exemplar sentence frame with slots (no answer tokens).
- Affix triad cue.
- Error-signature wedge (name the failure mode).
- Synonym ring reduction.
- Temporal anchor cue.

TOOLBOX — STEM (for hints)
- Worked-example + fading (scaffold then require generation).
- Interleaving across problem types.
- Contrastive examples for principle mapping.
- Explicit free-body-diagram heuristic (mechanics).
- Multimedia / dual-coding verbalizations for formulas/graphs.
- Unit check / dimensional match.
- Limiting cases (0, ∞, symmetry).
- Magnitude bounds / sanity window.
- Conservation scan (momentum/energy/charge/number).
- System isolate (boundary, external interactions).
- Dependency DAG (minimal solve order).
- Graph sense (slope=rate, area=accumulation).
- Sign discipline (one orientation).
- Linearity probe (superposition yes/no).
- Complement / independence routes; sensitivity scan; dimensional analysis.

TOOLBOX — STEM (for tips)
- Formula rhyme/tag (verbal, no symbols required).
- Order-of-magnitude anchor.
- Variable map in words.
- Free-body mental sketch in words.
- Equation verbalization (symbols → words).
- Worked-example skeleton (slots, not numbers).
- Checklist cue (units, signs, limits).
- Dual-coding micro-diagram described verbally.
- Scale-model analogy.
- Inverse sanity test.
- Endpoint check tag.
- Proportionality test cue.
- Base-case + growth pattern tag.
- Error-bar logic tag.
- “What changes what” micro-rule.

LANGUAGE SAFETY / DEMOTIONS
- Avoid vague phonetics or stress claims without evidence; provide IPA only when valid for the target language.
- Do not rely on minimal pairs with tiny contrasts when maximal contrasts exist.

INTERNAL SELF-CHECK (no output)
- Leak risk = false if no answer tokens or lists appear.
- Decisiveness = true only if L2 has one contrast OR one test.
- Usefulness = true if each level adds distinct value and matches likely test cues.

BASIC vs CLOZE
- Basic: reconstruct the back using rules/cues without tokens.
- Cloze: support only the first deletion; never paraphrase masked text.

- Output strict JSON only with the specified keys.
- Be concise, non-repetitive, and useful.
- Tips must be declarative and retrieval-oriented; never action-verby.`;


const BASIC_HINTS_BASE = `${HINTS_SYSTEM_PROMPT}

CARD TYPE: Basic (front/back). Reconstruct the back without leakage.`;

const CLOZE_HINTS_BASE = `${HINTS_SYSTEM_PROMPT}

CARD TYPE: Cloze deletions. Scaffold only the first cloze; never paraphrase masked text.`;

export function getHintsSystemPrompt(noteModel: NoteModel): string {
  // Return static prompt to enable OpenAI's prompt caching and reduce costs
  // Version: prompt-v2.1
  const base = noteModel === 'basic' ? BASIC_HINTS_BASE : CLOZE_HINTS_BASE;
  return base;
}

export function buildHintsUserPrompt(params: {
  items: Array<{ id: string; model: 'basic' | 'cloze'; front?: string; back?: string; cloze?: string; }>;
  deckName?: string;
  languageHints?: string[];
}): string {
  const { items, deckName, languageHints } = params;
  const langLine = languageHints?.length ? `Write every hint and tip in ${languageHints[0]} only.\n` : '';
  return `Generate hints for ${items.length} cards${deckName ? ` from "${deckName}"` : ''}:

${JSON.stringify(items)}

${langLine}Maintain input order and IDs. Return strict JSON with IDs: ${items.map(i => i.id).join(', ')}`;
}
