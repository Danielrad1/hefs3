# WYSIWYG Editor Implementation Plan

## Current State
The app uses a simple `RichTextEditor` that shows HTML tags (`<b>`, `<i>`, etc.) in the input field. Users have to manually wrap text with tags.

## Goal
True WYSIWYG editing like Microsoft Word where:
- Click **Bold** button → text types in bold
- Select text → click **Bold** → text becomes bold
- No HTML tags visible to user
- Images/audio embedded inline

## Recommended Solution: react-native-pell-rich-editor

### Why This Library?
- ✅ Most popular RN rich text editor (2.5k+ stars)
- ✅ True WYSIWYG - no HTML visible
- ✅ Supports bold, italic, underline, lists, images
- ✅ Works with Expo (via WebView)
- ✅ Customizable toolbar
- ✅ Returns HTML (compatible with Anki format)

### Installation
```bash
npm install react-native-pell-rich-editor react-native-webview
npx expo install react-native-webview
```

### Implementation Steps

#### 1. Replace RichTextEditor Component
Create `src/components/WYSIWYGEditor.tsx`:

```typescript
import React, { useRef } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { RichEditor, RichToolbar, actions } from 'react-native-pell-rich-editor';
import { useTheme } from '../design/theme';

interface WYSIWYGEditorProps {
  value: string;
  onChangeText: (html: string) => void;
  placeholder?: string;
  onInsertImage?: () => void;
  onInsertAudio?: () => void;
}

export default function WYSIWYGEditor({
  value,
  onChangeText,
  placeholder = 'Enter text...',
  onInsertImage,
  onInsertAudio,
}: WYSIWYGEditorProps) {
  const theme = useTheme();
  const richText = useRef<RichEditor>(null);

  return (
    <View style={styles.container}>
      <RichToolbar
        editor={richText}
        actions={[
          actions.setBold,
          actions.setItalic,
          actions.setUnderline,
          actions.insertBulletsList,
          actions.insertOrderedList,
          actions.setStrikethrough,
          actions.insertImage,  // Custom handler
          actions.undo,
          actions.redo,
        ]}
        iconMap={{
          [actions.insertImage]: () => <Ionicons name="image-outline" size={20} />,
        }}
        onPressAddImage={onInsertImage}
        style={{ backgroundColor: theme.colors.surface }}
        selectedIconTint={theme.colors.accent}
        iconTint={theme.colors.textSecondary}
      />
      <ScrollView style={styles.editorContainer}>
        <RichEditor
          ref={richText}
          initialContentHTML={value}
          onChange={onChangeText}
          placeholder={placeholder}
          androidHardwareAccelerationDisabled
          style={{ backgroundColor: theme.colors.bg }}
          editorStyle={{
            backgroundColor: theme.colors.bg,
            color: theme.colors.textPrimary,
            placeholderColor: theme.colors.textSecondary,
          }}
        />
      </ScrollView>
    </View>
  );
}
```

#### 2. Handle Image Insertion
When user clicks image button:
1. Show `MediaPickerSheet`
2. User selects image
3. Upload to media directory
4. Insert HTML: `<img src="filename.jpg">`

```typescript
const handleInsertImage = async () => {
  setMediaPickerVisible(true);
  setMediaType('image');
};

const handleMediaSelected = async (uri: string, filename: string) => {
  // Save to media directory
  const media = await mediaService.addMediaFile(uri, filename);
  
  // Insert into editor
  richText.current?.insertImage(media.filename);
  // This generates: <img src="filename.jpg">
};
```

#### 3. Handle Audio Insertion
Similar to images:
```typescript
const handleInsertAudio = async () => {
  setMediaPickerVisible(true);
  setMediaType('audio');
};

const handleAudioSelected = async (uri: string, filename: string) => {
  const media = await mediaService.addMediaFile(uri, filename);
  
  // Insert audio tag
  richText.current?.insertHTML(`[sound:${media.filename}]`);
  // Anki format for audio
};
```

#### 4. Cloze Deletions
For cloze cards, add custom button:
```typescript
const handleInsertCloze = () => {
  richText.current?.insertHTML('{{c1::text}}');
};
```

### Alternative: @10play/tentap-editor (More Modern)

If you want a more modern solution:

```bash
npm install @10play/tentap-editor
```

**Pros:**
- Built on ProseMirror (industry standard)
- Better TypeScript support
- More extensible
- Native feel (not WebView-based)

**Cons:**
- Newer (less battle-tested)
- More complex setup
- May need custom extensions for Anki format

### Migration Path

1. **Phase 1**: Install library
   ```bash
   npm install react-native-pell-rich-editor react-native-webview
   ```

2. **Phase 2**: Create new `WYSIWYGEditor` component (keep old one)

3. **Phase 3**: Update `NoteEditorScreen` to use new editor
   - Replace `RichTextEditor` with `WYSIWYGEditor`
   - Wire up image/audio handlers

4. **Phase 4**: Test thoroughly
   - Create notes with formatting
   - Insert images/audio
   - Verify Anki compatibility
   - Test on both iOS/Android

5. **Phase 5**: Remove old `RichTextEditor`

### Image/Audio Workflow

```
User Flow:
1. User types text in WYSIWYG editor
2. User clicks "Insert Image" button
3. MediaPickerSheet appears
4. User selects "Take Photo" or "Choose from Library"
5. Image is saved to media directory
6. Editor inserts: <img src="image_123.jpg">
7. When rendering card, CardContentRenderer shows the image

Audio is similar:
1. Click "Insert Audio"
2. Pick audio file
3. Saved to media directory
4. Editor inserts: [sound:audio_123.mp3]
5. CardContentRenderer shows audio player
```

### Rendering Compatibility

The `CardContentRenderer` already handles:
- ✅ `<img src="...">` tags
- ✅ `[sound:...]` tags
- ✅ Bold, italic, underline
- ✅ Cloze deletions

So HTML from WYSIWYG editor will render correctly!

### Testing Checklist

- [ ] Bold/italic/underline formatting works
- [ ] Image insertion and display
- [ ] Audio insertion and playback
- [ ] Cloze deletions render correctly
- [ ] HTML output is Anki-compatible
- [ ] Works on iOS simulator
- [ ] Works on Android emulator
- [ ] Doesn't break existing cards

### Estimated Effort

- **Setup & basic editor**: 2-3 hours
- **Image/audio integration**: 2-3 hours
- **Testing & refinement**: 2-4 hours
- **Total**: 6-10 hours

### Decision

**Recommend**: Start with `react-native-pell-rich-editor`
- Proven, stable
- Easy to integrate
- Works with your existing Anki HTML format
- Can always migrate to tentap-editor later if needed

Would you like me to implement this now?
