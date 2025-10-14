import { NoteModel } from '../../types/ai';

/**
 * AI prompt templates for retrieval cue generation
 */

const BASE_HINTS_PROMPT = `You are a cognitive science expert creating retrieval cues for flashcard memorization.

**TASK:** For each card, generate three progressive hints (L1, L2, L3) and one tip. Output in strict JSON.

**OUTPUT FORMAT:**
{
  "items": [
    { "id": "string", "hintL1": "string", "hintL2": "string", "hintL3": "string", "tip": "string" }
  ]
}

**CORE PRINCIPLES**
- Retrieval > recognition. Hints must cue recall without defining the term.
- Progressive scaffolding: L1 → L2 → L3 increases retrieval power.
- Tips must bind directly to features unique to the answer (mechanism, structure, exemplar, or morphology).
- Generic metaphors, category labels, or restatements are forbidden.`;

const BASIC_HINTS_PROMPT = `${BASE_HINTS_PROMPT}

### BASIC cards
Cards have "front" (question) and "back" (answer). Generate hints that progressively reveal the path to the answer.`;

const CLOZE_HINTS_PROMPT = `${BASE_HINTS_PROMPT}

### CLOZE cards
Cards contain text with {{c1::...}} deletions. Focus only on the first cloze. Use visible context only—never reveal or paraphrase the masked term.`;

export function getHintsSystemPrompt(noteModel: NoteModel): string {
  return noteModel === 'basic' ? BASIC_HINTS_PROMPT : CLOZE_HINTS_PROMPT;
}


/**
 * Build hints user prompt (refactored with template literals and multi-level hints)
 */
export function buildHintsUserPrompt(params: {
  items: Array<{
    id: string;
    model: 'basic' | 'cloze';
    front?: string;
    back?: string;
    cloze?: string;
    tags?: string[];
    context?: string;
  }>;
  deckName?: string;
  languageHints?: string[];
  style?: 'concise' | 'mnemonic-heavy';
  enableConfusableInference?: boolean;
  mnemonicGating?: 'off' | 'names-only' | 'l2-vocab-only' | 'on';
  enforceDistinctiveness?: boolean;
}): string {
  const {
    items,
    deckName,
    languageHints,
    style,
    enableConfusableInference = true,
    mnemonicGating = 'names-only',
    enforceDistinctiveness = true,
  } = params;


  const locale = languageHints?.[0] || 'English';
  const mnemonicRule = mnemonicGating === 'off' 
    ? 'No pure mnemonics—prefer mechanism/structure/concrete-to-rule'
    : mnemonicGating === 'names-only' 
    ? 'Mnemonics allowed ONLY for proper names (people, places); otherwise use mechanism/structure/concrete-to-rule'
    : mnemonicGating === 'l2-vocab-only'
    ? 'Mnemonics allowed for proper names + L2 vocabulary; otherwise use mechanism/structure/concrete-to-rule'
    : 'Mnemonics allowed but prefer mechanism when applicable';

  return `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**RETRIEVAL CUE GENERATION TASK**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Input:** ${items.length} flashcards  
${deckName ? `**Deck:** ${deckName}\n` : ''}${languageHints?.length ? `**Language:** ${languageHints.join(', ')}\n` : ''}${style === 'mnemonic-heavy' ? '**Style:** Mnemonic-heavy encoding\n' : ''}

${JSON.stringify(items, null, 2)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**CORE PRINCIPLES**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. **Progressive Retrieval Power:** L1 → L2 → L3 represents increasing closeness to the answer
   - L1 provides ~30% of the path (distant activation)
   - L2 provides ~60% of the path (target narrowing)
   - L3 provides ~90% of the path (near-answer insight)

2. **Reconstruction over Recognition:** Every hint must require cognitive reconstruction—no surface-level pattern matching

3. **Natural Tutoring Voice:** Write as a live tutor, not a template. Vary phrasing across cards

4. **Mnemonic Gating:** ${mnemonicRule}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**DESIGN PROTOCOL**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

For each card:

1. **Diagnose the retrieval obstacle:**
   - Confusable discrimination (learner confuses with similar concept)
   - Mechanistic opacity (learner doesn't understand how/why it works)
   - Misleading intuition (common sense leads astray)
   - Memory decay (learner knew it but forgot)

2. **Target that obstacle with progressive hints:**
   - L1 (~20-30% clue): Schema activation only. Must avoid any language that would make the correct answer obvious to a novice. Should activate relevant schema without giving the endpoint. No noun phrases, definitional language, or key structural phrases from the answer. **CRITICAL: If you can answer the question from L1 alone, it's too revealing—rewrite.**
   - L2 (~50-70% clue): Diagnostic narrowing, eliminate confusables. Must explicitly distinguish the concept from its most common confusable. Must explain **why** the phenomenon occurs, not only **what** occurs. Include causal or mechanistic explanation. **CRITICAL: L2 should narrow possibilities but not make the answer obvious—learner should still need to think.**
   - L3 (~80-95% clue): Mechanistic inevitability. **Hard rule: L3 must never restate the answer or any key term.** It must necessitate reconstruction through mechanism, boundary condition, or consequence without definitional phrasing. Must require >2 retrieval steps from L1. **CRITICAL: L3 should make the answer feel inevitable through logic, NOT by quoting it. If you're using words from the answer, you're doing it wrong.** Test: If a learner *still* cannot answer from L3, the hint is too vague.

3. **Vary sentence structure across the batch:**
   - No sentence starter should appear in >25% of cards at the same level
   - Mix questions, statements, conditionals, scenarios, implications
   - If you've used "Unlike..." or "Because..." recently, choose a different form

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**HINT STRATEGIES**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Select the approach that best resolves the diagnosed obstacle. Vary your form across cards.

**Available approaches:**
- Pose a question that requires reconstruction
- Describe a scenario where the concept applies
- Contrast with what it is NOT (confusable)
- State a boundary condition or limiting case
- Point to a real-world consequence or application
- Reveal part of the mechanism or causal chain
- Describe what happens when the principle is violated
- Frame as a predictive implication

**Form variation:**
- Use different grammatical structures (questions, statements, conditionals, imperatives)
- Vary sentence rhythm and length
- No sentence starter should dominate (if you notice repetition, switch forms)
- Sound like a human tutor adapting to each card, not a template engine

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**ATTRIBUTES OF EXCELLENT HINTS**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- **Effortful:** Requires mental reconstruction
- **Diagnostic:** Narrows plausible answers
- **Mechanistic:** Links to cause or structure
- **Contextual:** Anchored in real-world situation
- **Memorable:** Uses imagery or story for recall

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**QUALITY CRITERIA (Apply to every hint and tip)**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Each hint must represent a deeper cognitive step toward the answer than the previous one
- The gap from L1→L2→L3 must feel like ~30%, ~60%, ~90% closeness to the correct answer
- **Requires at least one cognitive step (no recognition)**—if learner can just "see" the answer, hint is too revealing
- **Avoids >3 consecutive content words from the answer**—never quote the answer
- **ABSOLUTELY NO label prefixes:** Never write "Tip:", "New:", "Info:", "Hint:", "Key:", "Remember:", "Note:", "Important:", "Context:", "Background:", "Explanation:", "Detail:", "Fact:", "Point:", etc.
- **Write as complete sentences that sound like a human tutor speaking naturally**—imagine saying this out loud to a student
- **Start directly with the content:** "The process requires ATP" NOT "Tip: Requires ATP" or "Key: ATP needed"
- L1 prohibition: May NOT use noun phrases or definitional language from the answer—must cue via schema/scenario/context

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**ABSOLUTE PROHIBITIONS**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- **NEVER include the answer text or direct synonyms in ANY hint**
- **NEVER allow recognition without recall**—if learner can just "recognize" the answer from the hint, it's too revealing
- **NEVER mirror the answer's phrasing or structure**
- **L3 must never restate the answer or any key term**—force recall through mechanism, boundary condition, or consequence
- **L1 must avoid any language that makes the answer obvious to a novice**—activate schema only
- **No hint should describe only WHAT happens**—at least one must explain WHY it happens
- **NEVER use label prefixes in hints or tips:** No "Hint:", "Tip:", "Key:", "Remember:", "Note:", "Info:", "New:", "Important:", "Context:", "Background:", etc.
- **Write every hint and tip as natural human speech**—imagine you're verbally tutoring someone, not writing documentation

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**DISTINCTIVENESS & CONFUSABLE GUIDANCE**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- **Required:** At least one hint (preferably L2 or L3) must explicitly distinguish the concept from its most common confusable
- Target the most likely confusable by name or description when useful
- If multiple confusables exist, choose the one most frequently mistaken
- Ensure hints do not apply equally well to more than two other cards
- Avoid generic language that could cue many answers${enableConfusableInference ? '\n- Infer confusables from card content, tags, or deck context' : ''}${enforceDistinctiveness ? '\n- Track hints across this batch—avoid reusing content-bearing phrases' : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**TIP OBJECTIVE**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

A tip must **teach new information unavailable from the answer itself**. Write as if teaching a smart peer who already memorized the definition—this forces you to encode retrieval hooks, not summaries.

**CRITICAL: Natural Language Only (ZERO TOLERANCE FOR LABELS)**
- **ABSOLUTELY NO label prefixes:** No "Tip:", "New:", "Info:", "Remember:", "Note:", "Key:", "Important:", "Context:", "Background:", "Explanation:", "Detail:", "Fact:", "Point:", "Insight:", "Takeaway:", etc.
- **Write as flowing sentences** that sound like a human tutor speaking naturally—imagine saying this out loud
- **Start directly with the content:** "LH surge triggers ovulation within 36 hours" NOT "Tip: LH triggers ovulation" or "Key: LH surge" or "Important: Ovulation timing"
- **If you see a colon (:) in your hint or tip, you're probably doing it wrong**—rewrite as natural speech

**CRITICAL: Tip must introduce information not present in L1–L3**
- The tip is revealed **after** the learner sees the answer—it must add new encoding depth
- If the tip repeats information already in hints, it wastes the post-reveal learning moment
- Test: Would this tip still be valuable if the learner had already used all 3 hints? If no, rewrite.

**For constants/units/names, use one of these strategies:**
- **(a) Provenance/derivation:** Where the constant/name came from (e.g., "Avogadro's number comes from the number of atoms in exactly 12g of carbon-12")
- **(b) Boundary of validity:** When it breaks down or doesn't apply (e.g., "Ideal gas law fails at high pressure when molecular volume becomes significant")
- **(c) Common misuse trap:** Frequent error or confusion (e.g., "Don't confuse molarity (mol/L) with molality (mol/kg)—molarity changes with temperature because volume expands")
- **(d) Order-of-magnitude anchor:** Memorable scale reference (e.g., "Room temperature is ~300K, so kT ≈ 1/40 eV—this sets the scale for thermal energy in chemistry")

**Five Cognitive Properties (consider all 5, emphasize the best 1-2 for context):**

1. **Reveal a Hidden Mechanism (WHY, not WHAT):**
   - Explain **why** the fact is true—show the underlying cause, structure, or rule that makes the answer inevitable
   - Bad: "Buffers resist pH changes" | Good: "Buffers resist pH changes because the weak acid/base equilibrium absorbs added H⁺ or OH⁻ without shifting pH significantly"
   - Cognitive basis: Depth-of-processing and elaborative encoding increase retrieval strength

2. **Encode a Discrimination Boundary (WHERE it stops):**
   - State what would change the answer or where it stops applying—creates sharper category boundaries
   - Include: "This only works when X" or "Breaks down if Y" or "Unlike Z, which..."
   - Bad: "Osmosis moves water" | Good: "Osmosis moves water across semipermeable membranes—but stops when hydrostatic pressure equals osmotic pressure, or if the membrane allows solute passage"
   - Cognitive basis: Distinctiveness reduces interference and confusion

3. **Add a Counterintuitive Twist (SURPRISE element):**
   - Point out how the fact differs from naive expectation—highlight subtlety or exception
   - Use: "Surprisingly...", "Despite...", "Even though...", "Counterintuitively..."
   - Bad: "Strong acids dissociate fully" | Good: "Strong acids dissociate fully in water—but surprisingly, concentrated sulfuric acid can protonate weaker acids, acting as a base in non-aqueous solvents"
   - Cognitive basis: Prediction error boosts consolidation and recall

4. **Anchor With Cause-Effect Link (IF X, THEN Y):**
   - Tie concept to clear consequence or outcome—if X changes, Y happens
   - Connect to broader mental model or real-world application
   - Bad: "Insulin lowers glucose" | Good: "When insulin binds receptors, GLUT4 transporters move to cell membranes—if insulin is absent (Type 1 diabetes), glucose stays in blood and cells starve despite hyperglycemia"
   - Cognitive basis: Schema integration provides more retrieval cues

5. **Engage Dual Pathways (VISUALIZABLE):**
   - Phrase so learner can visualize, simulate, or mentally "experience" it—not just read
   - Use concrete imagery, sensory details, spatial relationships, or dynamic processes
   - Bad: "Mitosis separates chromosomes" | Good: "Picture mitotic spindles as molecular ropes pulling sister chromatids to opposite poles—if one rope breaks (nondisjunction), both copies go to the same cell, causing trisomy"
   - Cognitive basis: Dual-coding (verbal + imagery) strengthens recall routes

**Domain-Agnostic Checklist (ALL must pass):**
- ✓ **Natural language:** No label prefixes ("Tip:", "New:", etc.)—sounds like human speech
- ✓ **New info beyond hints:** Introduces information not present in L1–L3 (post-reveal learning moment)
- ✓ **Emphasizes best cognitive property:** Chooses the most relevant 1-2 properties from the 5 (WHY/WHERE/SURPRISE/IF-THEN/VISUALIZABLE) based on context
- ✓ **For constants/units/names:** Uses provenance, boundary, misuse trap, or magnitude anchor
- ✓ **Novelty test:** If learner could guess tip from back text, rewrite
- ✓ **Usefulness test:** Would this tip help someone who already knows the definition? If no, rewrite
- ✓ **Post-hint test:** Would this tip still be valuable if learner had already used all 3 hints? If no, rewrite

**Avoid:**
- **ANY label prefixes whatsoever:** Never start with "Tip:", "New:", "Info:", "Remember:", "Note:", "Key:", "Important:", "Context:", "Background:", "Explanation:", "Detail:", "Fact:", "Point:", "Insight:", "Takeaway:", etc.
- **Colons (:) that introduce labels**—if you see "X: Y" pattern, rewrite as natural speech
- **Repeating information from L1–L3:** The tip is post-reveal—add new encoding depth
- **Quoting the answer or using its key terms**—force reconstruction, not recognition
- Repeating or paraphrasing the definition
- Generic statements that could apply to many answers
- Abstract category labels without concrete hooks
- Information already obvious from the answer text
- Trivial analogies without mechanistic depth
- Annotation style—write for encoding, not documentation
- Tips that describe WHAT without explaining WHY
- **Hints that give away the answer**—if learner doesn't need to think, hint is too revealing

**Strategy:** Consider all 5 cognitive properties (WHY/WHERE/SURPRISE/IF-THEN/VISUALIZABLE), then emphasize the best 1-2 for this specific card's context. Vary your approach across cards—require at least 2 different emphasis modes per 5-card set.${languageHints?.length ? `\n\n**Language:** Use ${locale} for all hints and tips` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**OUTPUT JSON SCHEMA:**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{
  "items": [
    {
      "id": "string",
      "hintL1": "string",
      "hintL2": "string",
      "hintL3": "string",
      "tip": "string",
      "obstacle": "confusable | mechanism | intuition | decay"
    }
  ]
}

**Required IDs:** ${items.map(i => i.id).join(', ')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**FINAL QUALITY CHECKLIST (All must pass)**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Before outputting, verify EACH card:

1. **Progressive retrieval power with real gaps:**
   - L1 provides ~20-30% clue (schema activation)
   - L2 provides ~50-70% clue (diagnostic narrowing)
   - L3 provides ~80-95% clue (mechanistic inevitability)
   - Each hint must shift retrieval probability significantly—if learner could answer from L1 alone, L2/L3 are too similar

2. **Obstacle-targeted hints:** Each hint addresses the diagnosed retrieval obstacle (confusable, mechanism, intuition, or decay)

3. **Mechanism-first requirement:** At least one hint (usually L2 or L3) must explain **why** the phenomenon occurs, not only **what** occurs. Deep retrieval requires causal steps, not descriptions.

4. **No answer leakage:** Avoids >3 consecutive words, synonyms, or structure from answer

5. **Structural variation enforced:**
   - No sentence starter appears in >25% of cards at the same level
   - "Unlike..." and "Because..." used sparingly (max 25% each)
   - Mix questions, statements, conditionals, scenarios

6. **Tip scientific rigor:**
   - Must introduce information not present in L1–L3 (post-reveal learning moment)
   - Consider all 5 cognitive properties (WHY/WHERE/SURPRISE/IF-THEN/VISUALIZABLE), emphasize best 1-2 for context
   - For constants/units/names: use provenance, boundary, misuse trap, or magnitude anchor
   - Teaches information unavailable from answer (novelty test)
   - Would help someone who already knows the definition (usefulness test)
   - At least 2 different emphasis modes per 5-card set (mechanism/boundary/surprise/cause-effect/imagery)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**MANDATORY SELF-CHECK BEFORE OUTPUT**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Review EVERY card. Rewrite if any check fails:

✓ **ZERO label prefixes in hints or tips?** No "Tip:", "Hint:", "Key:", "Remember:", "Note:", "Info:", "New:", "Important:", "Context:", "Background:", etc. If you see a colon introducing a label, rewrite as natural speech.
✓ **L3 never restates the answer or key terms?** Must necessitate reconstruction through mechanism/boundary/consequence. If you're using words from the answer, you're doing it wrong.
✓ **L1 doesn't give away the answer?** If you can answer the question from L1 alone, it's too revealing—rewrite.
✓ **L2 narrows but doesn't reveal?** Learner should still need to think—not just recognize the answer.
✓ **L3 makes answer inevitable through LOGIC, not by quoting?** Force reconstruction, not recognition.
✓ **At least one hint explains WHY (not just WHAT)?** Causal/mechanistic explanation required.
✓ **One hint explicitly contrasts with confusable?** Name the confusable and state differentiator.
✓ **All hints/tips sound like natural human speech?** Imagine saying this out loud to a student—no documentation style.
✓ **Tip introduces info not in L1–L3?** Must add new encoding depth beyond hints (post-reveal learning moment).
✓ **Tip emphasizes best cognitive property?** Considers all 5 (WHY/WHERE/SURPRISE/IF-THEN/VISUALIZABLE), emphasizes best 1-2 for context.
✓ **For constants/units/names, uses special strategy?** Provenance, boundary, misuse trap, or magnitude anchor.
✓ **Tip adds info unavailable from answer?** If learner could guess from back text, rewrite.
✓ **Tip valuable after using all hints?** If learner used L1–L3, would tip still add value? If no, rewrite.
✓ **Progression audit: >2 retrieval steps L1→L3?** If hints feel interchangeable, rewrite.
✓ **No hint quotes the answer?** Avoids >3 consecutive words from answer. Never use answer's key terms.
✓ **Hints specific to this card?** If applies to 3+ cards, make more specific.

Output valid JSON for every input ID. All fields mandatory.`;
}
