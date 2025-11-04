# Image Occlusion: Full Implementation Plan

This document specifies end-to-end functionality to add Image Occlusion to the app, covering authoring, studying, and Anki (Image Occlusion Enhanced) import compatibility. It maps the plan directly to current architecture and code touchpoints so implementation can proceed incrementally and safely.

## Goals
- Create and study image occlusion cards natively.
- Support common Anki Image Occlusion Enhanced decks on import (JSON- and SVG-based variants).
- Maintain Anki-like card generation behavior (one card per mask; Hide One/Hide All modes).
- Preserve app performance and UX consistency (instant reveal feel like current cloze flow; no image flicker).

## Non-Goals (initial)
- Exporting occlusion notes back into Anki-compatible .apkg.
- Polygon/irregular masks (Phase 3).
- Advanced per-mask annotations beyond “Extra” (Phase 3).

---

## User Flows

1) Create Occlusion
- From “Add” → “Image Occlusion”: pick an image (camera or library), draw rectangles, choose mode (Hide One / Hide All), optionally add “Extra” text, save → cards generated.

2) Study Occlusion
- Front shows the image with masks rendered as opaque overlays depending on mode and card index. Tap to reveal; back highlights the target region and optionally shows Extra text. Siblings are buried for the session.

3) Import IO Enhanced Decks
- During .apkg import, detect IO models/notes, parse IO metadata (JSON or SVG) to our format, re-generate the cards, keep media, and (optionally) preserve progress.

---

## Data Model and Generation

### New Model Type
- Add: `MODEL_TYPE_IMAGE_OCCLUSION = 2`
- Seed a default “Image Occlusion” model similar to the existing “Cloze” model.
  - Fields: `[Image, Extra]`
  - Templates:
    - `qfmt`: `<io-occlude data='{{OcclusionData}}'></io-occlude>`
    - `afmt`: `<io-occlude data='{{OcclusionData}}' reveal='true'></io-occlude><br>{{Extra}}`
  - CSS: simple baseline; renderer will control visuals.

Note: We won’t actually depend on template parsing at runtime (we output the effective HTML in Adapter), but we maintain Anki fidelity in the seeded model for consistency and potential future export.

### Note Shape
- Fields:
  - `Image` (fields[0]): filename only (e.g., `heart.png`)
  - `Extra` (fields[1]): optional HTML/text
- `note.data` (JSON payload stored in AnkiNote.data):
  ```json
  {
    "io": {
      "version": 1,
      "image": "heart.png",
      "mode": "hide-one" | "hide-all",
      "masks": [
        { "id": "m1", "x": 0.32, "y": 0.28, "w": 0.18, "h": 0.09 },
        { "id": "m2", "x": 0.10, "y": 0.55, "w": 0.22, "h": 0.12 }
      ],
      "naturalSize": { "w": 2048, "h": 1536 } // optional, for reference only
    }
  }
  ```
  - Coordinates are percentages relative to the rendered image (0–1) so scaling is lossless.
  - `mode` defines front/back masking logic (see Rendering).

### Card Generation Rules
- Similar to cloze generation in `NoteService`:
  - For an IO note, generate 1 card per mask → ord = index of mask (0-based), due = nextPos.
  - Store nothing extra in `AnkiCard.data` initially. All necessary info is in `note.data.io`.
  - Deleting a mask → delete/reindex cards (like cloze renumber).

### Front/Back HTML (Adapter)
- `Adapter.toViewCard()` should detect IO model and produce minimal HTML that `CardContentRendererV2` can interpret:
  - Front: `<io-occlude data='{...}' ord='0'></io-occlude>` // ord = mask index
  - Back: same tag, plus `reveal='true'`, and append rendered Extra below with a styled separator.
  - Keep the HTML small; the renderer reads `data` and lays out overlays.

---

## Rendering

File: `src/components/CardContentRendererV2.tsx`

### Approach
- Use `react-native-render-html` custom element support to register a renderer for `<io-occlude>` elements.
- The renderer component:
  - Reads attributes: `data` (stringified JSON), `ord`, `reveal`.
  - Loads image using existing media helpers (`getMediaUri`), sizes to content width (like existing <img>), then overlays absolutely positioned `View`s for each mask.
  - Scaling: multiply percent coords by measured image content width/height (already computed in CardContentRenderer via `contentWidth` and max image height calculations).

### Masking Behavior
- Hide One Guess One (mode = `hide-one`):
  - Front: The target mask (matching ord) is opaque; all other masks are faint, non-blocking outlines (optional) to match Anki behavior.
  - Back: The target region becomes highlighted (semi-transparent fill) and other masks are removed or faint.
- Hide All Guess One (mode = `hide-all`):
  - Front: All masks are opaque; the target one could use a distinct hint outline.
  - Back: Only the target region is revealed/highlighted (others remain hidden or become faint).

### Visual Details
- Mask fill: semi-opaque surface variant (theme aware). Suggested: rgba(0,0,0,0.34) on front; rgba(59,130,246,0.18) highlight on back for the target.
- Interaction: no gestures on study screen (authoring handles interaction). Avoid intercepting card tap.
- Performance: memoize parsing of `data`; precompute scaled rects when dimensions stabilize; recycle keys by `cardId` (like images).

### Renderer Integration Steps
1) Add a custom element model for `io-occlude` and a renderer function within `CardContentRendererV2`.
2) Compute image layout similarly to existing img styling: max width = `contentWidth`, max height = `maxImageHeight`.
3) Render base Image; onLayout, cache size; overlay masks accordingly.
4) Switch visuals based on `revealed` from `CardPage` (passed down via `revealed` prop). For occlusion we already show instant reveal; keep that behavior.

---

## Authoring (Editor)

### New Screen: ImageOcclusionEditorScreen
- Path: `src/app/Editor/ImageOcclusionEditorScreen.tsx`
- Features:
  - Select image from library or camera (reuse `MediaPickerSheet` and `MediaService.addMediaFile`).
  - Draw, move, and resize rectangular masks:
    - Gesture handler rectangles with 8 corner/edge handles; snap-to-edge; delete mask.
    - Maintain masks in percent coordinates; update on image resize.
  - Set occlusion mode (Hide One / Hide All) and order of masks (implicitly index order).
  - Optional: zoom/pan (Phase 2); Phase 1 can rely on large canvas and pinch-to-zoom later.
  - Save:
    - Create/Update note using `NoteService.createNote` with model = Image Occlusion model ID.
    - Fields: fields[0] = filename, fields[1] = Extra (optional, via a simple TextInput or WYSIWYG as needed).
    - Store JSON payload in `note.data`.
    - Generation: automatic via `NoteService` (occlusion type) to create cards.

### Entry Points
- Add “Image Occlusion” to add/create menu.
- Optional: In `NoteEditorScreen`, add a toolbar CTA “Open Occlusion Editor” if the current model is IO, but primary UX is a separate creation flow.

### Reuse
- `MediaService` for storing/locating images.
- `WYSIWYGEditor` is kept for rich text fields (Extra). For Phase 1, a regular input is OK.

---

## Import Compatibility (Anki Image Occlusion Enhanced)

File: `src/app/Decks/hooks/useDeckImport.ts`

### Detection
- Model name contains "Image Occlusion" or known add-on identifiers.
- Field set matches typical IO Enhanced types (e.g., fields like `Image`, `Header`, `Back Extra`, `Notes`, `Masks`), but expect variants.

### Data Sources
- JSON-based IO: Some IO add-on versions store a JSON blob describing masks (coords, mode). Prefer these when available.
- SVG-based IO: Older IO encodes overlays in SVG within a field (or as a generated image). Parse `<rect>` elements and normalize coords:
  - Extract `x`, `y`, `width`, `height` in pixels; normalize using the image natural width/height (if present) or the SVG viewBox.

### Conversion Strategy
1) For each IO note:
   - Resolve image filename via fields; ensure placed under media (already handled by importer).
   - Parse IO masks/mode into the internal `note.data.io` JSON.
   - Update fields to `[Image=filename, Extra=<converted or original extra>]`.
2) Delete the auto-imported IO cards for that note (they won’t match our model behavior) and regenerate via our occlusion generation in `NoteService`.
3) Optionally preserve review history (`revlog`) if `preserveProgress` is chosen:
   - Keep revlog entries; mapping card ord is 1:1 with mask index for typical IO. If ambiguity remains, preserve note-level progress but accept card-ID remap.

### Edge Cases
- Inconsistent model field orders: Use model.flds names to map to our fields.
- Missing natural size: Use image metadata if available; default to percent scaling by rendered size.
- Non-rect masks: Approximate bounding boxes (Phase 2+); initial scope supports rectangular only.

---

## Scheduler and Sibling Burying

File: `src/services/anki/SchedulerV2.ts`

### Requirement
- Avoid serving multiple siblings (masks from same note) close together. Match Anki behavior by burying siblings for a day or at least for the session.

### Approach
- Lightweight session-bury: when serving a card for note N, temporarily exclude other cards with `nid=N` until the next reload/day.
  - Maintain a `Set<string>` of buried CIDs or NIDs in `SchedulerProvider` context; filter in `getNext()/peekNext()` without persisting.
  - Alternatively, mark siblings `CardQueue.UserBuried` and restore next day; initial implementation can stay session-scoped filtering to avoid state churn.

---

## Touchpoints and Changes

1) Constants and Model
- `src/services/anki/schema.ts`
  - Add `export const MODEL_TYPE_IMAGE_OCCLUSION = 2;`
- `src/services/anki/InMemoryDb.ts`
  - Seed Image Occlusion model with fields [Image, Extra] and placeholder templates.

2) Card Generation
- `src/services/anki/NoteService.ts`
  - Detect model type = IO and generate one `AnkiCard` per mask (`note.data.io.masks.length`).
  - Utility to list mask indices similar to `extractClozeIndices`.

3) Render
- `src/components/CardContentRendererV2.tsx`
  - Add custom element model and renderer for `<io-occlude>`:
    - Measure image, render overlays per mode and `revealed`.
    - Use `getMediaUri()` to resolve the image.

4) Adapter
- `src/services/anki/Adapter.ts`
  - When converting `AnkiCard` to UI `Card`, if model is IO:
    - Build front/back HTML with `<io-occlude data="..." ord="..." [reveal] />` and append `Extra` on back.

5) Authoring
- New screen: `src/app/Editor/ImageOcclusionEditorScreen.tsx`
  - Gestures for creating/resizing masks.
  - Save to `NoteService.createNote` with IO model ID and `note.data.io` payload.
- Entry point button from add/create or Editor toolbar.

6) Import
- `src/app/Decks/hooks/useDeckImport.ts`
  - After parsing SQLite and before final persistence:
    - Detect IO notes.
    - Convert IO fields → our format, delete their cards, regenerate via `NoteService`.
    - Preserve media via existing `MediaService.batchRegisterExistingMedia`.

7) Optional: Session bury
- `src/context/SchedulerProvider.tsx` + `src/services/anki/SchedulerV2.ts`
  - Track/Filter siblings of current `nid` in selection pipeline.

---

## Rendering Details

### Pseudocode for Renderer
```tsx
function IoOccludeRenderer({ data, ord, reveal }) {
  const payload = JSON.parse(data) as IoData;
  const imageUri = getMediaUri(payload.image);
  const [layout, setLayout] = useState<{w:number;h:number}|null>(null);

  const masks = useMemo(() => payload.masks, [data]);
  const target = masks[Number(ord)] || null;

  const overlayFor = (m) => {
    const x = m.x * layout.w; const y = m.y * layout.h;
    const w = m.w * layout.w; const h = m.h * layout.h;
    const isTarget = target && m.id === target.id;
    const style = reveal
      ? (isTarget ? styles.highlight : styles.faint)
      : (payload.mode === 'hide-one'
          ? (isTarget ? styles.opaque : styles.faint)
          : styles.opaque);
    return <View key={m.id} style={[styles.mask, { left:x, top:y, width:w, height:h }, style]} />
  };

  return (
    <View onLayout={(e) => setLayout(e.nativeEvent.layout)}>
      <Image source={{ uri: imageUri }} style={{ width: contentWidth, height: computedHeight }} />
      {layout && masks.map(overlayFor)}
    </View>
  );
}
```

### Visual Styles
- `opaque`: solid surface overlay (e.g., rgba(0,0,0,0.34))
- `highlight`: theme accent bg with low opacity
- `faint`: thin outline only (no fill), for context without revealing

---

## Authoring Details

### Mask Editing Model
- Maintain masks in percent coords. On image layout change, render overlays based on new layout.
- Create mask: tap-drag to draw rect.
- Edit mask: drag to move; handles to resize; delete via toolbar.
- Mode toggle (Hide One / Hide All).
- Field `Extra` text input underneath.

### Save
- Ensure image is saved to media store via `MediaService.addMediaFile`.
- Construct `note.data.io` JSON and call `NoteService.createNote` with IO model.
- On edit, call `NoteService.updateNote` and regenerate cards.

---

## Testing & QA

### Unit
- `NoteService` IO generation → ord mapping, counts, updates after mask edits.
- Adapter produces correct HTML tag with ord and reveal flag.

### Integration
- Renderer overlays align correctly at various sizes/aspect ratios.
- Import conversion:
  - JSON IO → parsed into internal payload, cards match masks count.
  - SVG IO → parse `<rect>` with correct normalization.

### Manual QA
- Very large images (4k), very small masks; portrait vs landscape.
- Many masks (e.g., 30) still performant.
- Sibling bury avoids repeats in one session.

---

## Risks & Mitigations
- IO Variant Diversity: start with most common field shapes, ship conversion behind a tolerant pipeline (log and skip malformed notes gracefully).
- Performance: memoize and avoid re-rendering; keep overlays lightweight; recycle image cache keys using `cardId` (already in renderer).
- Touch precision: add small min size and hit slop; provide zoom later if necessary.

---

## Work Breakdown & Timeline

Phase 1 (1–2 weeks)
- Add constants/model seeding (schema/InMemoryDb)
- IO generation in NoteService + Adapter HTML
- Renderer custom element + overlays
- New Authoring screen with basic mask editing
- Session bury (lightweight filter)

Phase 2 (1–2 weeks)
- Import detection + JSON conversion
- SVG parser for `<rect>` extraction + normalization
- Robust field-name mapping; regenerate cards; optional progress preservation

Phase 3 (optional)
- Zoom/pan in editor; polygon masks; export parity

---

## Acceptance Criteria
- Can create an occlusion note with 2+ masks and study it; masks render/hide correctly for both modes.
- Cards regenerate when masks change (add/remove/reorder) and ord mapping stays correct.
- Importing a known IO Enhanced deck results in functional occlusion notes (for common variants); media present; no crashes.
- Study does not show multiple siblings in one session (bury works).

---

## File/Code References (for implementation)
- Add model type: `memorize-app/src/services/anki/schema.ts`
- Seed model: `memorize-app/src/services/anki/InMemoryDb.ts`
- Card generation: `memorize-app/src/services/anki/NoteService.ts`
- View adapter: `memorize-app/src/services/anki/Adapter.ts`
- Renderer: `memorize-app/src/components/CardContentRendererV2.tsx`
- Authoring: `memorize-app/src/app/Editor/ImageOcclusionEditorScreen.tsx` (new)
- Media helpers: `memorize-app/src/services/anki/MediaService.ts`, `memorize-app/src/utils/mediaHelpers.ts`
- Import conversion: `memorize-app/src/app/Decks/hooks/useDeckImport.ts`
- Session bury: `memorize-app/src/context/SchedulerProvider.tsx`, `memorize-app/src/services/anki/SchedulerV2.ts`

