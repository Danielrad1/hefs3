# All Decks Compatibility Plan

This document specifies an implementation to import and render Anki decks with high fidelity across standard models and common add-ons (notably Image Occlusion Enhanced), without requiring add-on code. It maps decisions to concrete edit points in this repo and includes a validation plan.


## Objectives
- Import .apkg exactly: models, decks, notes, cards, tags, CSS, revlog, media.
- Render cards by evaluating Anki templates (`qfmt/afmt`) with parity for core semantics.
- Provide robust Image Occlusion (IO) support across encodings and modes.
- Preserve card IDs and review history; avoid remapping unless unavoidable.
- Offer safe degradation for unknown filters/models; app never crashes on unknown content.


## Current State (repo)
- Import pipeline
  - `.apkg` unzip + SQLite + media: `src/services/anki/apkg` (UnzipStrategy, SqliteParser, MediaExtractor)
  - Orchestrator: `src/services/anki/ApkgParser.ts`
  - Import hook and persistence: `src/app/Decks/hooks/useDeckImport.ts`
  - Revlog imported and persisted.
- Models/DB
  - In-memory Anki schema with seeded Basic/Cloze/IO models: `src/services/anki/InMemoryDb.ts`
  - Schema types: `src/services/anki/schema.ts`
- Rendering
  - Adapter to UI `Card`: `src/services/anki/Adapter.ts`
  - Card content renderer with custom `<io-occlude>`: `src/components/CardContentRendererV2.tsx`
- Card generation
  - `NoteService.generateCards()` handles standard, cloze, and basic IO: `src/services/anki/NoteService.ts`
- Scheduler
  - `SchedulerV2` with session-based sibling burying: `src/services/anki/SchedulerV2.ts`

Key gaps and inconsistencies
- Standard models with custom templates are not rendered with `qfmt/afmt`; Adapter falls back to fields[0]/[1]. See Adapter.ts:114–124.
- IO hide-all creates a single card (should be one per mask). See NoteService.ts:275–303.
- IO Adapter emits `ord='all'` for hide-all (renderer can’t highlight target). See Adapter.ts:151.
- IO renderer hide-all back hides everything instead of highlighting target. See CardContentRendererV2.tsx:186–198.
- Import conversion for IO handles a subset; needs additional encodings and robust field-name mapping.


## Principles
- Treat imported Anki tables as the source of truth. Do not remap IDs unless technically required.
- Achieve parity by evaluating templates and supporting common filters; normalize only when necessary (e.g., IO mask data).
- Unknown -> degrade gracefully: render raw fields via template fallback, log once.


## Phase 1 — Template Engine Parity
Implement a lightweight, safe template engine to render `qfmt` and `afmt` for standard models.

Scope
- Fields: `{{FieldName}}` replacement; HTML preserved.
- Sections: `{{#Field}}…{{/Field}}`, `{{^Field}}…{{/Field}}` where truthiness = field non-empty after trim of HTML.
- FrontSide: `{{FrontSide}}` supported only on `afmt`; compute by rendering `qfmt` first.
- Filters (minimal viable):
  - `cloze:Field` — when model.type = Cloze and for given card `ord`, render target cloze as blanks on front and fully revealed on back (parity with Anki’s semantics is good-enough for most decks; exact leech highlighting not required initially).
  - `type:Field` — render unmodified field content (typing UI not implemented initially).
  - `text:Field` — render escaped text (strip HTML).
  - Unknown filter — log once and return field content unchanged.

Files and edits
- New: `src/services/anki/TemplateEngine.ts`
  - `render(model, note, ord, which: 'q'|'a'): { front: string; back: string }`
  - Utilities: field map by name (case-insensitive), section handling, filter registry.
- Adapter fallback
  - File: `src/services/anki/Adapter.ts:96`
  - If model.type is standard and not the internal IO model, use TemplateEngine to compute `front` and `back` using `model.tmpls[ankiCard.ord]`.

Acceptance
- Basic, Reversed, Optional Reversed, Cloze variants render acceptably without special handling.


## Phase 2 — Image Occlusion Parity
Make IO behave like Anki IO on both imported and authored notes.

A) Generation: one card per mask for both modes
- File: `src/services/anki/NoteService.ts:275`
  - Replace the single-card hide-all branch with a loop generating one card per mask: `ord = maskIndex`.

B) Adapter: always numeric ord
- File: `src/services/anki/Adapter.ts:151`
  - Change `ordAttr` to `String(ankiCard.ord)` (remove `'all'`).

C) Renderer: correct hide-all revealed state
- File: `src/components/CardContentRendererV2.tsx:186–198`
  - Hide-all front: all masks `opaque`.
  - Hide-all back: target `highlight`, others `faint` (not `hidden`).

D) Template filter (optional, for external IO templates)
- In `TemplateEngine`, register `image-occlusion` filter signatures to emit `<io-occlude>` with `data`, `ord`, and `reveal` based on `which` side.

Acceptance
- Imported IO decks and locally authored IO notes render consistently; hide-all highlights target on the back.


## Phase 3 — Import Normalization for IO Variants
Enhance `convertImageOcclusionNotes(...)` to populate `note.data.io` for multiple encodings while preserving `mid/cid`.

Detection
- Model name hints: contains “image occlusion”, “io”.
- Template name hints: “Hide One”, “Hide All”.
- Field name hints: `Occlusion`, `Masks`, `Image`, `Question Mask`, `Back Extra`.
- Content hints: occlusion spec strings, JSON arrays, SVG, Base64 JSON, HTML comment JSON.

Parsing sources
- JSON array in any field (existing behavior). Keep if elements include x,y,w,h.
- Text occlusion spec in fields similar to `{{c1::image-occlusion:rect:left=.4124:top=.2996:width=.14:height=.0231:oi=1}}`:
  - Regex: `/image-occlusion:(rect|ellipse|polygon):([^}\s>]+)/i`
  - Key/values separator `:` then `=` → normalize numeric values to 0–1.
- Base64 JSON data URI:
  - Pattern: `data:application/json;base64,([A-Za-z0-9+/=]+)` → decode → JSON.parse
- HTML comment JSON:
  - Pattern: `<!--\s*IO[:=]\s*({[\s\S]*?})\s*-->` → JSON.parse
- SVG
  - Rects (existing). Add polygons:
    - Match `<polygon[^>]*points="([^"]+)"[^>]*>` → parse points to [(x,y)...], compute bbox → normalize using `viewBox` or image natural size.

Mode detection per note
- If any of the note’s `cards` map to a template named “Hide All”, set `mode='hide-all'`; otherwise `'hide-one'`.

Field mapping
- Map using model field names (case-insensitive), not just indices. Extract image filename by:
  - If field contains `<img ... src="…">`, use `src`.
  - Else consider field value a filename.

Writeback
- Store `note.data.io` only. Do not change `mid` or delete cards.
- Renderer and/or TemplateEngine will read `note.data.io` regardless of model.

File and edit
- File: `src/app/Decks/hooks/useDeckImport.ts:333` (inside `convertImageOcclusionNotes`)
  - Add parsers + mode detection + field-name mapping.

Acceptance
- Majority of IO Enhanced decks render without add-ons; no ID remap.


## Phase 4 — Add‑On Profile Registry
Unify detection, normalization and filter support for known ecosystems.

- New: `src/services/anki/AddonProfiles.ts`
  - Interface: `{ id: string; match(model, note): boolean; normalize?(note, model, db): Promise<void>; filters?: Record<string, FilterFn>; }`
  - Built-ins:
    - Image Occlusion Enhanced (the logic from Phase 3)
    - Hint filters: `{{hint:Field}}` → emit collapsible/hint wrapper rendered in RN (simple, non-blocking)
    - Cloze Overlapper (most behave with `cloze` already; detect to avoid duplicate transforms)
- Integrate profiles
  - At import time: run each profile’s `normalize` where `match` is true.
  - In `TemplateEngine`: when encountering `filter:Field`, first consult any profile-registered filter before default handlers.

Acceptance
- Common add-on templates render without errors; unknown filters show content unfiltered.


## Phase 5 — CSS, LaTeX, Media, and Safety

CSS
- Respect `model.css` by injecting a `<style>` tag at top of HTML content or translating into `tagsStyles` overrides.
- Map `.card`, `.cloze`, and common heading styles to RN styles.

LaTeX
- Detect `$...$`, `\(...\)`, `\[...\]` and render via a Math component (optional), or degrade to text if disabled in settings.
- Respect `latexPre/latexPost` minimally by wrapping if present.

Media
- Keep `mediaId → filename` mapping from `media` JSON; ensure `getMediaUri` handles URL-encoded and case variants.
- Add a debug log for unresolved media (no crash).

Safety
- Unknown filter: log once then passthrough.
- Invalid template: fallback to field[0]/[1] rendering.
- Timeouts: long templates (rare) should be bounded in TemplateEngine execution.


## Adapter: Final Behavior Matrix
- IO internal model (mid=3 seeded): build `<io-occlude>` using `note.data.io` and numeric `ord`.
- Standard models (type=0): render via TemplateEngine using `qfmt/afmt`.
- Cloze models (type=1): TemplateEngine with `cloze` filter handles behavior.

Edit points
- `src/services/anki/Adapter.ts:96` — insert template fallback.
- `src/services/anki/Adapter.ts:151` — ord should be numeric, not `'all'`.


## Scheduler and Revlog
- Import cards’ scheduling fields exactly; keep revlog as-is.
- Use existing `SchedulerV2` for new answers; optionally support a “strict parity” toggle which uses imported due values for the first study session post-import.
- Continue session burying to avoid IO sibling clumping.


## Validation Plan
Unit tests
- TemplateEngine
  - Field substitution, sections (truthy/falsey), FrontSide.
  - Filters: cloze (multiple indices), type, unknown.
- IO parsers
  - JSON, Base64 JSON, comment JSON, text spec, SVG rects and polygons.

Integration tests
- Adapter → Renderer for: Basic, Reversed, Cloze, IO hide-one/hide-all.
- Import normalization on representative sample decks (assets-only tests, no bundling of full .apkg in CI).

Manual QA
- Import known IO Enhanced deck variants; verify:
  - Hide-One: front target masked opaque, back highlights target; others faint.
  - Hide-All: front all opaque; back target highlighted, others faint.
- Style fidelity: fonts/headings; audio; large images; math (if enabled).


## Rollout Plan
1) Implement TemplateEngine + Adapter fallback + IO renderer fixes.
2) Enhance IO normalization (without changing mid/cid).
3) Add Add-on profiles for hints and IO; log unknown filters once.
4) QA with catalogue of decks; ship behind a feature flag toggled on prod gradually.


## Risks & Mitigations
- Add-on filter diversity: mitigate with profile registry + graceful passthrough.
- IO polygon/irregular shapes: start with rect/polygon bbox; plan Phase 3 to add polygon rendering if needed.
- CSS fidelity in RN: translate common classes, ignore exotic selectors.
- Performance: memoize template rendering per card; reuse parsed fields; avoid heavy DOM.


## Precise Edit Points (for quick patching)
- `src/services/anki/NoteService.ts:275` — remove single-card hide-all; generate N cards (ord=maskIndex) for both modes.
- `src/services/anki/Adapter.ts:151` — set `const ordAttr = String(ankiCard.ord)`.
- `src/components/CardContentRendererV2.tsx:186` — hide-all back should highlight target (others faint), not hide all.
- `src/services/anki/Adapter.ts:96` — when model.type is standard and not IO, compute `front/back` via new `TemplateEngine` using `model.tmpls[ankiCard.ord]`.
- `src/app/Decks/hooks/useDeckImport.ts:333` — extend `convertImageOcclusionNotes` with field-name mapping, mode detection via templates, and additional parsers (text spec, Base64 JSON, comment JSON, SVG polygons).


## Appendix — Pseudocode Snippets

TemplateEngine — render
```
const render = (model, note, ord, which) => {
  const fields = split(note.flds, '\x1f');
  const byName = buildCaseInsensitiveMap(model.flds.map(f => f.name), fields);
  const tmpl = model.tmpls[ord];
  const q = applyFilters(processSections(tmpl.qfmt, byName));
  const front = substituteFields(q, byName, ord, 'q');
  let back = substituteFields(processSections(tmpl.afmt, byName), byName, ord, 'a');
  back = back.replace(/{{FrontSide}}/g, front);
  return { front, back };
}
```

IO hide-all correction (renderer)
```
if (isHideAll) {
  maskStyle = revealed
    ? (isTarget ? highlight : faint)
    : opaque;
}
```

IO generation (NoteService)
```
for (let i=0; i<masks.length; i++) addCard({ ord: i, ... })
```

---

This plan keeps Anki’s model/templating at the center, adds a robust compatibility layer for IO, and ensures unknown deck types remain usable. It maps cleanly to your codebase with minimal invasive changes and clear validation steps.

