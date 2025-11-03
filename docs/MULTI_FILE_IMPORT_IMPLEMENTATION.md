# Multi-File Import Implementation Summary

## Status: In Progress

### Completed

1. **✅ Created `/src/services/ai/promptBuilders.ts`**
   - `FileAttachment` interface
   - `InstructionOptions` interface with all parameters
   - `composeNotesTextFromAttachments()` - Assembles notesText from files + instructions
   - `getTotalCharacterCount()` - Calculates total chars across files
   - `getFileIconName()` - Returns appropriate icon for file type
   - `formatFileSize()` - Human-readable file sizes
   - `getDefaultInstructions()` - Default instruction options

2. **✅ Updated `AIDeckCreatorScreen.tsx` imports**
   - Added all prompt builder imports
   - Removed unused imports

3. **✅ Added TabType and constants**
   - `TabType = 'prompt' | 'files' | 'instructions'`
   - `CHARACTER_WARNING_THRESHOLD = 300000`

4. **✅ Updated State Structure**
   - `activeTab` for tab navigation
   - `attachments: FileAttachment[]` instead of single file
   - `isParsingFile` instead of `isParsing`
   - `instructions: InstructionOptions` for all instruction parameters
   - Removed `notesText`, `showImportOptions`, `importedFileName`, `noteModel`

### Next Steps Required

The file `/src/app/Decks/AIDeckCreatorScreen.tsx` needs the following major replacements:

#### 1. Replace `handleImportFile` (lines 51-179) with:
```typescript
const handleAddFile = async () => {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        'text/plain',
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ],
      copyToCacheDirectory: true,
    });

    if (result.canceled) return;

    const file = result.assets[0];
    const fileId = `${Date.now()}_${Math.random()}`;

    const newAttachment: FileAttachment = {
      id: fileId,
      name: file.name,
      mimeType: file.mimeType || 'application/octet-stream',
      size: file.size,
      uri: file.uri,
    };

    setAttachments((prev) => [...prev, newAttachment]);
    setIsParsingFile(true);

    try {
      let parsedText = '';

      if (file.mimeType === 'text/plain' || file.name.endsWith('.txt')) {
        parsedText = await FileSystem.readAsStringAsync(file.uri);
      } else if (
        file.name.endsWith('.docx') ||
        file.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ) {
        const base64 = await FileSystem.readAsStringAsync(file.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const response = await ApiService.post<{ text: string }>('/parse/file', {
          fileData: base64,
          fileType: 'docx',
          fileName: file.name,
        });
        parsedText = response.text;
      } else if (file.name.endsWith('.pdf') || file.mimeType === 'application/pdf') {
        const base64 = await FileSystem.readAsStringAsync(file.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const response = await ApiService.post<{ text: string }>('/parse/file', {
          fileData: base64,
          fileType: 'pdf',
          fileName: file.name,
        });
        parsedText = response.text;
      }

      setAttachments((prev) =>
        prev.map((att) => (att.id === fileId ? { ...att, parsedText } : att))
      );
    } catch (error) {
      logger.error('File parsing error:', error);
      Alert.alert(
        'Parsing Error',
        `Failed to parse ${file.name}. You can remove it and try a different file.`
      );
    } finally {
      setIsParsingFile(false);
    }
  } catch (error) {
    logger.error('Import error:', error);
    Alert.alert('Import Error', 'Failed to import file. Please try again.');
    setIsParsingFile(false);
  }
};

const handleRemoveFile = (fileId: string) => {
  setAttachments((prev) => prev.filter((att) => att.id !== fileId));
};

const handleMoveFile = (fileId: string, direction: 'up' | 'down') => {
  setAttachments((prev) => {
    const index = prev.findIndex((att) => att.id === fileId);
    if (index === -1) return prev;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= prev.length) return prev;

    const newAttachments = [...prev];
    [newAttachments[index], newAttachments[newIndex]] = [
      newAttachments[newIndex],
      newAttachments[index],
    ];
    return newAttachments;
  });
};
```

#### 2. Replace `handleGenerate` (lines 181-208) with:
```typescript
const handleGenerate = async () => {
  const hasPrompt = prompt.trim().length > 0;
  const hasFiles = attachments.length > 0;

  if (!hasPrompt && !hasFiles) {
    Alert.alert('Missing Input', 'Please enter a prompt or add at least one file.');
    return;
  }

  const unfinishedFiles = attachments.filter((att) => !att.parsedText);
  if (unfinishedFiles.length > 0) {
    Alert.alert(
      'Files Still Processing',
      'Some files are still being parsed. Please wait a moment and try again.'
    );
    return;
  }

  const isOnline = await NetworkService.isOnline();
  if (!isOnline) {
    Alert.alert(
      'No Internet Connection',
      'AI deck generation requires an internet connection.'
    );
    return;
  }

  const limit = parseInt(itemLimit) || 50;

  let composedNotesText = '';
  if (hasFiles) {
    composedNotesText = composeNotesTextFromAttachments(attachments, instructions, limit);
  }

  let finalPrompt = '';
  let finalNotesText = composedNotesText;

  if (hasPrompt && !hasFiles) {
    finalPrompt = prompt.trim();
  } else if (hasPrompt && hasFiles) {
    finalNotesText = `USER TOPIC REQUEST:\n${prompt.trim()}\n\n${composedNotesText}`;
  }

  navigation.navigate('AIDeckModelSelection' as any, {
    prompt: finalPrompt,
    notesText: finalNotesText,
    noteModel: instructions.cardFormat,
    itemLimit: limit,
  });
};
```

#### 3. Remove `handleSubscribePress` function (lines 210-217)
Not needed - PremiumUpsellModal handles this internally.

#### 4. Add character count calculation before return statement:
```typescript
const totalChars = getTotalCharacterCount(attachments);
const showCharacterWarning = totalChars > CHARACTER_WARNING_THRESHOLD;
```

#### 5. Replace entire JSX (lines 228-523) with three-tab interface
See full implementation in backup file or refer to the spec document.

Key JSX structure needed:
- Header (unchanged)
- Tab Bar with 3 tabs
- ScrollView containing:
  - `renderPromptTab()` - Simple text input
  - `renderFilesTab()` - Add file button + file chips with reorder/remove
  - `renderInstructionsTab()` - All instruction controls
  - Card count selector (always visible)
- Generate button footer

### Files Modified
1. ✅ `/src/services/ai/promptBuilders.ts` - Created
2. 🔄 `/src/app/Decks/AIDeckCreatorScreen.tsx` - Partially updated
3. ⏳ `/src/app/Decks/AIDeckModelSelectionScreen.tsx` - No changes needed
4. ⏳ `/src/app/Decks/AIGeneratingScreen.tsx` - No changes needed

### Backend Integration
- ✅ No backend changes required
- ✅ Reuses existing `/parse/file` endpoint
- ✅ Reuses existing `/ai/deck/generate` endpoint
- ✅ `notesText` parameter accepts the composed string

### Testing Checklist
- [ ] Import single .txt file
- [ ] Import single .docx file
- [ ] Import single .pdf file
- [ ] Import multiple files (mixed types)
- [ ] Reorder files using arrow buttons
- [ ] Remove individual files
- [ ] Character warning appears for large content
- [ ] Instructions tab controls work
- [ ] Generation with prompt only
- [ ] Generation with files only
- [ ] Generation with prompt + files
- [ ] Verify notesText composition includes all sections
- [ ] Verify card count selector still works
- [ ] Premium modal for >25 cards

### Known Issues
- Large JSX file replacement needed (700+ lines)
- May need to break into smaller components for maintainability

### Recommendation
Complete the JSX replacement as a single large edit, or:
1. Extract tab renderers into separate component files
2. Extract file chip component
3. Extract instruction controls component

This would make the code more maintainable and easier to test.
