# Card Deletion Feature - Testing Guide

## What Was Added

Added card deletion functionality to the **Card Browser** screen with two interaction methods:
1. **Tap the trash icon** on the right side of each card
2. **Long-press any card** to trigger delete

## How to Test

### 1. Navigate to Card Browser
```
1. Open app
2. Go to Decks tab
3. Tap any deck
4. Tap "Browse Cards"
```

### 2. Delete a Single Card (from multi-card note)
```
Test Case: Note with multiple cards (e.g., cloze cards)
1. Find a card from a note that has multiple cards
2. Tap the trash icon OR long-press the card
3. Alert shows: "Delete this card? The note has X cards total..."
4. Tap "Delete"
5. ✅ Only that card is deleted
6. ✅ Other cards from same note remain
7. ✅ Card list refreshes automatically
```

### 3. Delete Last Card (deletes entire note)
```
Test Case: Note with only one card
1. Find a card from a note with only one card
2. Tap the trash icon OR long-press the card
3. Alert shows: "Delete this card and its note? This cannot be undone."
4. Tap "Delete"
5. ✅ Card is deleted
6. ✅ Note is deleted
7. ✅ Associated media is cleaned up (if orphaned)
8. ✅ Success alert appears
9. ✅ Card list refreshes
```

### 4. Test Media Cleanup (Tests Your Hash Fix!)
```
Test Case: Verify orphaned media is garbage collected
1. Create a card with an image
2. Delete that card (ensure it's the only card using that image)
3. Check console logs for: "[MediaService] Cleaning up orphaned media files..."
4. ✅ Orphaned media should be deleted
5. ✅ Media with same hash used by other cards should NOT be deleted
```

### 5. Cancel Delete
```
1. Tap trash icon or long-press card
2. Tap "Cancel" in alert
3. ✅ Nothing happens
4. ✅ Card remains in list
```

### 6. Test on Physical Device
```
After running: npx expo run:ios --device

1. Repeat all above tests
2. Verify haptic feedback works (if implemented)
3. Verify no crashes or freezes
4. Check that persistence works (deleted cards stay deleted after app restart)
```

## UI Elements

### Card Row Layout
```
┌─────────────────────────────────────────────┐
│ Front text preview...                       │
│ 📁 Deck Name    🖼️ 🎵 [NEW]    🗑️  │
└─────────────────────────────────────────────┘
```

- **Trash icon (🗑️)**: Visible on every card, subtle gray color
- **Long-press**: Works anywhere on the card row
- **Hit area**: Trash icon has expanded touch target for easy tapping

## What Happens Behind the Scenes

### Single Card Deletion
```typescript
await cardService.deleteCards([cardId]);
// - Removes card from database
// - Adds to graves table (for sync)
// - Note remains if it has other cards
```

### Full Note Deletion
```typescript
await noteService.deleteNote(noteId);
// - Deletes all cards for that note
// - Deletes the note itself
// - Runs media garbage collection
// - Cleans up orphaned media files
```

### Media Cleanup (Your Hash Fix in Action!)
```typescript
// After note deletion, MediaService.gcUnused() runs
// - Scans all notes for media references
// - Deletes media files not referenced anywhere
// - Uses REAL hash for deduplication (your fix!)
// - Duplicate files (same hash) are preserved if still referenced
```

## Expected Console Logs

### Successful Deletion
```
[CardBrowser] Delete error: undefined (if no error)
[NoteService] Cleaning up orphaned media files...
[MediaService] Garbage collected X unused media files
```

### Media Deduplication Working
```
[MediaService] Media with same hash already exists, deduplicating: filename.jpg
```

## Edge Cases to Test

### 1. Delete All Cards in Deck
```
1. Browse cards in a deck
2. Delete all cards one by one
3. ✅ Deck should be empty but still exist
4. ✅ No crashes
```

### 2. Delete While Searching
```
1. Search for cards
2. Delete a card from search results
3. ✅ Card disappears from results
4. ✅ Search results refresh correctly
```

### 3. Delete with Filters Active
```
1. Apply filters (e.g., "New" cards)
2. Delete a card
3. ✅ Filtered list updates
4. ✅ No crashes
```

### 4. Rapid Deletion
```
1. Quickly tap delete on multiple cards
2. ✅ Each alert appears sequentially
3. ✅ No race conditions
4. ✅ All deletions complete successfully
```

## Known Limitations

- **No undo**: Deletions are permanent (matches Anki behavior)
- **No bulk delete**: Must delete cards one at a time
- **No swipe gestures**: Only tap/long-press (simpler, more reliable)

## Future Enhancements (Optional)

- [ ] Swipe-to-delete gesture
- [ ] Bulk selection mode (checkbox multi-select)
- [ ] Undo/trash bin with 30-day retention
- [ ] Confirmation preference (skip alert for power users)
- [ ] Delete animation (fade out)

## Troubleshooting

### Delete button not working
- Check console for errors
- Verify `noteService` is initialized
- Ensure `handleDeleteCard` is in dependency array

### Media not cleaning up
- Check that `MediaService.gcUnused()` is called
- Verify media references in note fields
- Check console for GC logs

### App crashes on delete
- Check that card/note exists before deletion
- Verify persistence service is working
- Check for circular dependencies

---

**Status**: ✅ **IMPLEMENTED** - Card deletion with media cleanup
**Related**: MEDIA_HASH_FIX.md - Real hashing enables proper media deduplication
