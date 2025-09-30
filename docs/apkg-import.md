# .apkg Import Feature

## ✅ Phase 1 & 2 Complete

### **What Was Built:**

1. **Settings UI** (`SettingsScreen.tsx`)
   - File picker button for selecting .apkg files
   - Real-time import progress display
   - Success/error notifications
   - Clean, themed interface

2. **.apkg Parser** (`ApkgParser.ts`)
   - Unzips .apkg files (ZIP format)
   - Extracts `collection.anki2` (SQLite database)
   - Parses Anki schema: col, cards, notes, decks, dconf
   - Extracts media files (images, audio)
   - Stores media in app filesystem

3. **Dependencies Installed:**
   - `expo-document-picker` - File selection
   - `expo-file-system` - File operations
   - `expo-sqlite` - SQLite database
   - `jszip` - ZIP extraction

### **How It Works:**

```typescript
User taps "Import .apkg File"
       ↓
Document picker opens
       ↓
User selects .apkg file
       ↓
ApkgParser.parse(fileUri)
       ↓
1. Unzip .apkg
2. Extract collection.anki2
3. Parse SQLite (cards, notes, col, decks)
4. Extract media files
5. Store in app filesystem
       ↓
Import into InMemoryDb
       ↓
Success! Cards ready to study
```

### **What Works Now:**

- ✅ Import real Anki .apkg files
- ✅ Extract all cards, notes, decks
- ✅ Preserve scheduling data (intervals, ease, reps)
- ✅ Extract media files (images, audio)
- ✅ Multi-deck support
- ✅ Progress tracking during import

### **File Structure After Import:**

```
app-documents/
├── temp/
│   └── collection.anki2 (temporary, deleted after parse)
└── media/
    ├── image1.jpg
    ├── audio1.mp3
    └── ...
```

## 🚧 What's Next (Phase 3)

### **Rich Content Rendering:**

Currently, cards are imported but display as plain text. Next steps:

1. **HTML Rendering** (Easy)
   - Replace `<Text>` with `WebView` in CardPage
   - Render HTML content from `notes.flds`
   - Support basic formatting (bold, italic, lists)

2. **Image Support** (Easy)
   - Parse `<img src="filename.jpg">` tags
   - Replace with local file paths
   - Display in WebView

3. **Audio Support** (Medium)
   - Parse `[sound:filename.mp3]` syntax
   - Add play button
   - Use `expo-av` for playback

4. **Template Rendering** (Medium)
   - Parse Anki templates from `models`
   - Substitute fields: `{{Front}}`, `{{Back}}`
   - Handle conditionals: `{{#Field}}...{{/Field}}`

5. **Cloze Deletion** (Medium)
   - Parse `{{c1::text}}` syntax
   - Show/hide based on cloze number
   - Support multiple clozes per card

## 📝 Usage Instructions

### **For Users:**

1. Go to **Settings** tab
2. Tap **"Import .apkg File"**
3. Select an Anki deck file (.apkg)
4. Wait for import (progress shown)
5. Go to **Decks** tab to see imported decks
6. Start studying!

### **For Testing:**

Download any Anki deck:
- AnkiWeb: https://ankiweb.net/shared/decks
- Export from Anki desktop: File → Export → .apkg

### **Current Limitations:**

- Media (images/audio) extracted but not yet rendered
- HTML content displays as plain text
- Cloze cards not yet supported
- Templates not yet rendered

These will be implemented in Phase 3!

## 🎯 Technical Details

### **Anki .apkg Format:**

```
deck.apkg (ZIP file)
├── collection.anki2    # SQLite database
├── media               # JSON: {"0": "img.jpg", "1": "audio.mp3"}
├── 0                   # actual img.jpg file
├── 1                   # actual audio.mp3 file
└── ...
```

### **SQLite Schema Imported:**

```sql
-- Collection (single row)
SELECT * FROM col;

-- Cards (scheduling data)
SELECT id, nid, did, type, queue, due, ivl, factor, reps, lapses FROM cards;

-- Notes (content)
SELECT id, flds, tags, mid FROM notes;

-- Decks, configs parsed from col.decks, col.dconf JSON
```

### **Media Storage:**

- Media files stored in: `FileSystem.documentDirectory + 'media/'`
- Mapping stored in `ApkgParseResult.mediaFiles`
- Accessible via: `file://${mediaDir}${filename}`

## 🔧 Next Development Steps

1. **Add WebView to CardPage** for HTML rendering
2. **Create media URL resolver** to map Anki media to local paths
3. **Parse templates** from `col.models` JSON
4. **Implement template engine** (Mustache-style)
5. **Add audio player component**
6. **Implement cloze deletion logic**

All the heavy lifting (parsing, extraction, storage) is done! Now it's just UI rendering. 🎉
