# Image Occlusion Implementation Summary

## Overview
Successfully implemented Phase 1 of Image Occlusion feature following the comprehensive plan in `docs/image-occlusion-plan.md`. This enables users to create flashcards from images with masked regions, supporting both "Hide One" and "Hide All" study modes.

## Changes Made

### 1. Schema & Data Model
**File:** `src/services/anki/schema.ts`
- Added `MODEL_TYPE_IMAGE_OCCLUSION = 2` constant
- Defines the new card type for image occlusion notes

### 2. Database Initialization
**File:** `src/services/anki/InMemoryDb.ts`
- Seeded Image Occlusion model (ID: 3) with fields: [Image, Extra]
- Template structure:
  - `qfmt`: `<io-occlude data="{{OcclusionData}}"></io-occlude>`
  - `afmt`: `<io-occlude data="{{OcclusionData}}" reveal="true"></io-occlude><br>{{Extra}}`
- Maintains Anki compatibility for future import/export

### 3. Card Generation Logic
**File:** `src/services/anki/NoteService.ts`
- Updated `generateCards()` to handle `MODEL_TYPE_IMAGE_OCCLUSION`
- Generates one card per mask (0-based ord)
- Added `extractImageOcclusionMaskIndices()` to parse mask data from `note.data.io`
- Cards regenerate automatically when masks change (similar to cloze behavior)

### 4. HTML Adapter
**File:** `src/services/anki/Adapter.ts`
- Updated `toViewCard()` to detect IO model type
- Added `toImageOcclusionCard()` helper function
- Generates custom `<io-occlude>` HTML elements with:
  - `data` attribute: JSON stringified occlusion data
  - `ord` attribute: mask index
  - `reveal` attribute: true/false for front/back
  - Appends Extra field on back side

### 5. Custom Renderer
**File:** `src/components/CardContentRendererV2.tsx`
- Created `ImageOcclusionRenderer` component
- Integrated with `react-native-render-html` custom renderer system
- Features:
  - Loads images using existing `getMediaUri()` helper
  - Renders masks as absolute positioned overlays
  - Calculates dimensions maintaining aspect ratio
  - Mask styling:
    - **Opaque**: `rgba(0, 0, 0, 0.75)` - hides content
    - **Highlight**: `rgba(59, 130, 246, 0.22)` - blue tint for revealed
    - **Faint**: transparent with outline - context without revealing
  - Mode-based rendering:
    - **Hide One**: Target mask opaque, others faint on front
    - **Hide All**: All masks opaque on front
    - **Back**: Target highlighted, others faint

### 6. Editor Screen
**File:** `src/app/Editor/ImageOcclusionEditorScreen.tsx`
- Complete image occlusion authoring interface
- Features:
  - Image picker (camera/library) via `expo-image-picker`
  - Mask creation at center (tap-drag to position in future enhancement)
  - Mask selection and deletion
  - Mode toggle (Hide One / Hide All)
  - Extra text field for additional notes
  - Save button with mask count display
- Data flow:
  - Images saved via `MediaService.addMediaFile()`
  - Note data stored in `note.data` as JSON with structure:
    ```json
    {
      "io": {
        "version": 1,
        "image": "filename.png",
        "mode": "hide-one" | "hide-all",
        "masks": [
          { "id": "m1", "x": 0.32, "y": 0.28, "w": 0.18, "h": 0.09 }
        ],
        "naturalSize": { "w": 2048, "h": 1536 }
      }
    }
    ```
  - Coordinates stored as percentages (0-1) for lossless scaling

### 7. Entry Point
**File:** `src/app/Decks/DeckDetailScreen.tsx`
- Updated `handleAddNote()` to show options dialog
- Two choices: "Text Note" or "Image Occlusion"
- Routes to appropriate editor based on selection

### 8. Sibling Burying
**File:** `src/services/anki/SchedulerV2.ts`
- Added session-based sibling burying system
- New properties:
  - `buriedNoteIds: Set<string>` - tracks buried note IDs
- New methods:
  - `burySiblings(cardId: string)` - bury all siblings of a card
  - `clearBuriedSiblings()` - reset for new session/deck
  - `getBuriedCount()` - get count of buried notes
- Updated `getNext()` and `peekNext()` to filter buried siblings
- Prevents multiple masks from same note appearing in one session

## Data Structure

### Image Occlusion Note Format
```typescript
interface ImageOcclusionData {
  version: number;
  image: string;              // filename only
  mode: 'hide-one' | 'hide-all';
  masks: Array<{
    id: string;               // unique mask ID
    x: number;                // percentage 0-1
    y: number;                // percentage 0-1
    w: number;                // percentage 0-1
    h: number;                // percentage 0-1
  }>;
  naturalSize?: {
    w: number;                // original image width
    h: number;                // original image height
  };
}
```

## Architecture Decisions

1. **Percentage Coordinates**: Masks use 0-1 percentages for lossless scaling across different screen sizes
2. **Separate Model Type**: New `MODEL_TYPE_IMAGE_OCCLUSION` keeps code clean and maintainable
3. **Custom HTML Element**: `<io-occlude>` tag allows renderer flexibility without polluting HTML structure
4. **Session Burying**: Lightweight Set-based approach avoids database writes while preventing sibling repeats
5. **Anki Compatibility**: Template structure matches Anki format for future import/export support

## Testing Recommendations

### Unit Tests
- `NoteService.extractImageOcclusionMaskIndices()` - parse mask data correctly
- `Adapter.toImageOcclusionCard()` - generate correct HTML structure
- Card generation creates correct number of cards per mask count

### Integration Tests
- Renderer overlays align at various sizes/aspect ratios
- Mask visibility changes correctly with reveal state
- Mode switching updates mask rendering appropriately

### Manual QA
- Large images (4K) render and scale properly
- Many masks (20+) maintain performance
- Both portrait and landscape images work correctly
- Sibling burying prevents duplicates in study session
- Extra field displays correctly on back side

## Future Enhancements (Not in Phase 1)

### Phase 2 - Anki Import
- Detect IO Enhanced decks during import
- Parse JSON and SVG-based mask formats
- Convert to internal format and regenerate cards
- Preserve review history if requested

### Phase 3 - Advanced Features
- Polygon/irregular masks
- Zoom/pan in editor
- Drag to move/resize masks with gestures
- Per-mask annotations
- Export to Anki-compatible format

## Known Limitations

1. **Basic Editor**: Current editor adds masks at center position only. Drag-to-position and resize handles are future enhancements.
2. **Rectangular Masks Only**: Polygon/freeform masks not yet supported.
3. **No Import**: Anki IO deck import not yet implemented (Phase 2).
4. **Session-Only Burying**: Buried siblings reset when app restarts (could persist in future).

## Files Modified/Created

### Modified
- `src/services/anki/schema.ts`
- `src/services/anki/InMemoryDb.ts`
- `src/services/anki/NoteService.ts`
- `src/services/anki/Adapter.ts`
- `src/services/anki/SchedulerV2.ts`
- `src/components/CardContentRendererV2.tsx`
- `src/app/Decks/DeckDetailScreen.tsx`

### Created
- `src/app/Editor/ImageOcclusionEditorScreen.tsx`

## Git Branch
All changes are on the `image-occlusion` branch and ready for review/testing.

## Next Steps
1. Test the implementation thoroughly
2. Build native dev client if using Reanimated features: `npx expo run:ios`
3. Create sample occlusion notes with various mask counts
4. Verify study flow and sibling burying behavior
5. Consider Phase 2 (Anki import) if needed
