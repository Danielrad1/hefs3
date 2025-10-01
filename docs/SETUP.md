# Setup Instructions

## Install Missing Dependencies

```bash
cd /Users/danielrad/Desktop/repos/hefs2/memorize-app
npx expo install expo-image-picker
```

## Run the App

### Development Mode
```bash
npm start
# or
npx expo start
```

### Build Native Development Client (Required for Reanimated 3)
```bash
npx expo run:ios
# or
npx expo run:android
```

## Test the New Features

### 1. Create a Deck
1. Open the app
2. Navigate to Decks tab
3. Tap the "+" button
4. Enter deck name (e.g., "French::Vocabulary")
5. Tap Create
6. Verify deck appears in the list

### 2. Create a Note
1. Long-press a deck
2. Select "Study Now" (this will show no cards message)
3. Go back, we need to add notes first
4. For now, you can add notes via the browser (once navigation is wired)

### 3. Browse Cards
1. Add CardBrowserScreen to Tabs navigation
2. Or add a "Browse" button to DecksScreen
3. Search for cards
4. Test multi-select and bulk suspend

### 4. Edit a Note
1. From browser, tap a card
2. Should open NoteEditorScreen
3. Edit fields, add tags
4. Save and verify changes

## Current Status

✅ **Implemented:**
- Data layer with full Anki schema
- Service layer (Deck, Note, Card, Media, Search, Cloze)
- Persistence (JSON snapshots)
- DecksScreen with CRUD operations
- CardBrowserScreen with search and filters
- NoteEditorScreen with rich text editing
- MediaPickerSheet for images/audio
- ClozeService for cloze authoring
- Database loading on app start
- Bulk operations (suspend, delete)

⚠️ **Pending:**
- Install expo-image-picker
- Wire navigation Decks → Browser → Editor
- Add "Add Note" button to DecksScreen
- Test end-to-end workflows

## Navigation Setup (Quick)

To quickly add the browser to your app, edit `src/navigation/Tabs.tsx`:

```typescript
import CardBrowserScreen from '../app/Browser/CardBrowserScreen';

// In Tab.Navigator:
<Tab.Screen 
  name="Browser" 
  component={CardBrowserScreen}
  options={{ title: 'Browse' }}
/>
```

## Troubleshooting

### "Cannot find module 'expo-image-picker'"
Run: `npx expo install expo-image-picker`

### "Database not loading"
Check console logs for `[App] Loading database...`
Check file exists: `${FileSystem.documentDirectory}anki-db.json`

### "Cards not updating after suspend"
Verify `PersistenceService.save()` is called
Call `reload()` from SchedulerProvider

### "Search returns no results"
Call `searchIndex.indexAll()` after loading database
Verify notes exist in database

## Development Tips

1. **Use Console Logs**: All services log their operations
2. **Check File System**: `${FileSystem.documentDirectory}` for db and media
3. **Test Incrementally**: Create deck → Note → Study
4. **Inspect Database**: Use `console.log(db.toJSON())` to dump state
5. **Clear Data**: Delete `anki-db.json` to start fresh

## Next Steps

1. Install expo-image-picker
2. Add Browser to navigation
3. Add NoteEditor to navigation  
4. Add "Add Note" floating button to DecksScreen
5. Test create → study workflow
6. Test bulk operations
7. Test media insertion
8. Add scheduler safety hooks

Happy coding! 🚀
