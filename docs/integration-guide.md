# Integration Guide

Quick guide to wire up the new Anki features into the existing app.

## 1. Install Missing Dependency

```bash
cd /Users/danielrad/Desktop/repos/hefs2/memorize-app
npx expo install expo-image-picker
```

## 2. Load Persistence on App Start

Edit `App.tsx` or your main initialization file:

```typescript
import { PersistenceService } from './src/services/anki/PersistenceService';
import { db } from './src/services/anki/InMemoryDb';

// In your app initialization (before SchedulerProvider mounts)
useEffect(() => {
  async function loadDatabase() {
    const loaded = await PersistenceService.load(db);
    if (!loaded) {
      console.log('No saved database, starting fresh');
    }
  }
  loadDatabase();
}, []);
```

## 3. Add Navigation to CardBrowserScreen

### Option A: Add to Tab Navigator (Quick)

Edit `src/navigation/Tabs.tsx`:

```typescript
import CardBrowserScreen from '../app/Browser/CardBrowserScreen';

<Tab.Screen name="Browser" component={CardBrowserScreen} />
```

### Option B: Navigate from DecksScreen (Better UX)

In `src/app/Decks/DecksScreen.tsx`, add a "Browse" action to the deck actions:

```typescript
const getDeckActions = (deck: { id: string; name: string }): DeckAction[] => {
  const actions: DeckAction[] = [
    {
      id: 'study',
      label: 'Study Now',
      icon: '📚',
      onPress: () => handleDeckPress(deck.id),
    },
    {
      id: 'browse',
      label: 'Browse Cards',
      icon: '🔍',
      onPress: () => {
        // Navigate to browser with deck filter
        navigation.navigate('Browser', { deckId: deck.id });
      },
    },
    // ... rest of actions
  ];
};
```

## 4. Add "Add Note" Button

In `src/app/Decks/DecksScreen.tsx`, add a floating action button:

```typescript
<Pressable
  style={[styles.fab, { backgroundColor: theme.colors.accent }]}
  onPress={() => {
    navigation.navigate('NoteEditor', {
      modelId: '1', // Basic model
      deckId: currentDeckId || '1',
    });
  }}
>
  <Text style={styles.fabText}>+</Text>
</Pressable>
```

Styles:
```typescript
fab: {
  position: 'absolute',
  bottom: 20,
  right: 20,
  width: 60,
  height: 60,
  borderRadius: 30,
  justifyContent: 'center',
  alignItems: 'center',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 5,
  elevation: 8,
},
fabText: {
  fontSize: 32,
  fontWeight: '600',
  color: '#000',
},
```

## 5. Wire CardBrowserScreen → NoteEditorScreen

In `src/app/Browser/CardBrowserScreen.tsx`, update the card press handler:

```typescript
const renderCard = ({ item: card }: { item: AnkiCard }) => {
  // ...
  return (
    <Pressable
      onPress={() => {
        if (isMultiSelect) {
          toggleCardSelection(card.id);
        } else {
          // Navigate to editor
          navigation.navigate('NoteEditor', {
            noteId: card.nid,
          });
        }
      }}
      // ...
    >
```

## 6. Implement Bulk Actions

In `src/app/Browser/CardBrowserScreen.tsx`:

```typescript
const handleBulkSuspend = async () => {
  try {
    const cardIds = Array.from(selectedCards);
    cardService.suspend(cardIds);
    await PersistenceService.save(db);
    
    // Reload cards
    loadCards();
    setIsMultiSelect(false);
    setSelectedCards(new Set());
    
    Alert.alert('Success', `Suspended ${cardIds.length} cards`);
  } catch (error) {
    Alert.alert('Error', 'Failed to suspend cards');
  }
};

const handleBulkDelete = async () => {
  const count = selectedCards.size;
  
  Alert.alert(
    'Delete Cards',
    `Are you sure you want to delete ${count} cards?`,
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const cardIds = Array.from(selectedCards);
            cardService.deleteCards(cardIds);
            await PersistenceService.save(db);
            
            loadCards();
            setIsMultiSelect(false);
            setSelectedCards(new Set());
            
            Alert.alert('Success', `Deleted ${count} cards`);
          } catch (error) {
            Alert.alert('Error', 'Failed to delete cards');
          }
        },
      },
    ]
  );
};

// In JSX:
<Pressable onPress={handleBulkSuspend}>
  <Text>Suspend</Text>
</Pressable>
<Pressable onPress={handleBulkDelete}>
  <Text>Delete</Text>
</Pressable>
```

## 7. Add Scheduler Safety Hooks

Create a hook in SchedulerProvider to invalidate cache on mutations:

```typescript
// In SchedulerProvider.tsx

const invalidateCache = useCallback(() => {
  // Force scheduler to rebuild queue
  loadCards();
}, [loadCards]);

// Expose it
const value: SchedulerContextValue = {
  // ...existing values
  invalidateCache,
};

// Use it after bulk operations
// e.g., in CardBrowserScreen after suspend/delete:
const { invalidateCache } = useScheduler();
await invalidateCache();
```

## 8. Testing Workflow

### Test 1: Create Deck → Create Note → Study
1. Open DecksScreen
2. Tap "+" to create deck "Test::Subdeck"
3. Long-press deck → "Add Note" (or use FAB)
4. Fill in Front/Back fields
5. Add a tag "test"
6. Save
7. Navigate to Study
8. Verify card appears

### Test 2: Import → Browse → Edit
1. Import an .apkg file (existing flow)
2. Navigate to Browser
3. Search for a card
4. Tap to open editor
5. Edit a field
6. Save
7. Return to study, verify changes

### Test 3: Bulk Operations
1. Open Browser
2. Long-press a card to enter multi-select
3. Select multiple cards
4. Tap "Suspend"
5. Verify they don't appear in study queue
6. Unsuspend them
7. Verify they reappear

### Test 4: Media Insertion
1. Create new note
2. In a field, tap image button
3. Choose from library
4. Verify `<img>` tag inserted
5. Save note
6. Study the card
7. Verify image displays correctly

### Test 5: Cloze Cards
1. Create note with Cloze model
2. Type: "Paris is the capital of France"
3. Select "Paris" → insert cloze
4. Should become: "{{c1::Paris}} is the capital of France"
5. Save
6. Verify 1 card generated
7. Study → Front shows "[...] is the capital of France"
8. Reveal → Shows "Paris"

## 9. Optional Enhancements

### Add Deck Stats to DecksScreen
```typescript
const deckStats = deckService.getStats(deck.id);

<Text>
  {deckStats.newCount} new · 
  {deckStats.learningCount} learning · 
  {deckStats.reviewCount} review
</Text>
```

### Add Search History
```typescript
const [searchHistory, setSearchHistory] = useState<string[]>([]);

const handleSearch = (query: string) => {
  if (query && !searchHistory.includes(query)) {
    setSearchHistory([query, ...searchHistory].slice(0, 10));
  }
};
```

### Add Undo for Bulk Operations
```typescript
const [undoStack, setUndoStack] = useState<Array<() => void>>([]);

const handleBulkSuspend = async () => {
  const cardIds = Array.from(selectedCards);
  cardService.suspend(cardIds);
  
  // Push undo action
  setUndoStack([...undoStack, () => {
    cardService.unsuspend(cardIds);
  }]);
};
```

## 10. Performance Tips

### Lazy Load Browser
Only initialize SearchIndex when browser is opened:

```typescript
const searchIndex = useMemo(() => {
  if (isFocused) {
    const index = new SearchIndex(db);
    index.indexAll();
    return index;
  }
  return null;
}, [isFocused]);
```

### Debounce Search
```typescript
const debouncedSearch = useMemo(
  () =>
    debounce((text: string) => {
      const noteIds = searchIndex.search(text);
      // ... update results
    }, 300),
  [searchIndex]
);
```

### Virtualize Editor Fields
For models with many fields, use FlatList instead of map:

```typescript
<FlatList
  data={model.flds}
  renderItem={({ item, index }) => (
    <RichTextEditor ... />
  )}
  keyExtractor={(item) => item.name}
/>
```

## 11. Troubleshooting

### Cards not appearing in study
- Check `PersistenceService.save()` is called after mutations
- Call `SchedulerProvider.reload()` to refresh
- Verify cards are not suspended (`queue !== -1`)

### Media not displaying
- Check file exists: `FileSystem.getInfoAsync(mediaUri)`
- Verify media directory created: `MediaService.ensureMediaDir()`
- Check permissions granted for camera/library

### Search returns no results
- Call `searchIndex.indexAll()` after loading database
- Verify `updateNote()` calls `searchIndex.updateNote(note)`
- Check search query tokenization

### Cloze cards not generating
- Verify model type is `1` (cloze)
- Check cloze syntax: `{{c1::text}}`
- Call `NoteService.updateNote()` to regenerate

---

## Quick Checklist

- [ ] Install expo-image-picker
- [ ] Load persistence in App.tsx
- [ ] Add Browser to navigation
- [ ] Add NoteEditor to navigation
- [ ] Wire deck actions to Browser
- [ ] Add "Add Note" FAB
- [ ] Implement bulk suspend
- [ ] Implement bulk delete
- [ ] Test create → study flow
- [ ] Test edit → verify changes
- [ ] Test media insertion
- [ ] Test cloze generation
- [ ] Add scheduler invalidation hooks
- [ ] Performance test with 1000+ cards

---

**Ready to integrate!** Follow the steps above and you'll have a fully functional Anki-like experience. 🚀
