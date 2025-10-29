/**
 * NoteEditorScreen - Edit note fields, tags, and preview cards
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert, TextInput, KeyboardAvoidingView, Platform, Keyboard, TouchableWithoutFeedback, ActionSheetIOS } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/theme';
import { s } from '../../design/spacing';
import { r } from '../../design/radii';
import { db } from '../../services/anki/InMemoryDb';
import { NoteService } from '../../services/anki/NoteService';
import { MediaService } from '../../services/anki/MediaService';
import { ClozeService } from '../../services/anki/ClozeService';
import { PersistenceService } from '../../services/anki/PersistenceService';
import { useScheduler } from '../../context/SchedulerProvider';
import WYSIWYGEditor, { WYSIWYGEditorRef } from '../../components/WYSIWYGEditor';
import MediaPickerSheet, { MediaType } from '../../components/MediaPickerSheet';
import { FIELD_SEPARATOR, MODEL_TYPE_CLOZE } from '../../services/anki/schema';
import { logger } from '../../utils/logger';

interface NoteEditorScreenProps {
  route?: {
    params?: {
      noteId?: string;
      modelId?: string;
      deckId?: string;
    };
  };
  navigation?: any;
}

type CardType = 'basic' | 'cloze' | 'image-occlusion';

export default function NoteEditorScreen({ route, navigation }: NoteEditorScreenProps) {
  const theme = useTheme();
  const { reload } = useScheduler();
  const noteId = route?.params?.noteId;
  
  // Smart default: use first available model if modelId not provided (memoized to prevent re-renders)
  const getDefaultModelId = React.useMemo(() => {
    if (route?.params?.modelId) {
      return route.params.modelId;
    }
    const models = db.getAllModels();
    if (models.length > 0) {
      return models[0].id;
    }
    return 1;
  }, [route?.params?.modelId]);
  
  const getDefaultDeckId = React.useMemo(() => {
    if (route?.params?.deckId) return route.params.deckId;
    const decks = db.getAllDecks().filter(d => d.id !== '1');
    if (decks.length > 0) return decks[0].id;
    return '1';
  }, [route?.params?.deckId]);

  const [noteService] = useState(() => new NoteService(db));
  const [mediaService] = useState(() => new MediaService(db));
  const [clozeService] = useState(() => new ClozeService());
  
  const [modelId, setModelId] = useState(getDefaultModelId);
  const [deckId, setDeckId] = useState(getDefaultDeckId);
  const [fields, setFields] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [currentFieldIndex, setCurrentFieldIndex] = useState(0);
  const [fieldSelections, setFieldSelections] = useState<Record<number, { start: number; end: number }>>({});
  const [mediaPickerVisible, setMediaPickerVisible] = useState(false);
  const [mediaType, setMediaType] = useState<MediaType>('image');
  const [isSaving, setIsSaving] = useState(false);
  const editorRefs = React.useRef<Record<number, WYSIWYGEditorRef | null>>({});

  const model = db.getModel(modelId);
  const deck = db.getDeck(deckId);

  // Determine current card type based on modelId
  const getCurrentCardType = (): CardType => {
    if (modelId === 2) return 'cloze';
    if (modelId === 3) return 'image-occlusion';
    return 'basic';
  };

  const handleCardTypeChange = (type: CardType) => {
    if (type === 'image-occlusion') {
      // Navigate to Image Occlusion editor
      navigation?.navigate?.('ImageOcclusionEditor', { deckId });
    } else if (type === 'cloze') {
      setModelId(2);
      // Reset fields for new model
      if (!noteId) {
        const clozeModel = db.getModel(2);
        if (clozeModel) {
          setFields(new Array(clozeModel.flds.length).fill(''));
        }
      }
    } else {
      // Basic
      setModelId(1);
      // Reset fields for new model
      if (!noteId) {
        const basicModel = db.getModel(1);
        if (basicModel) {
          setFields(new Array(basicModel.flds.length).fill(''));
        }
      }
    }
  };

  // Load note if editing
  useEffect(() => {
    if (noteId) {
      const note = db.getNote(noteId);
      if (note) {
        setModelId(note.mid);
        const noteFields = note.flds.split(FIELD_SEPARATOR);
        setFields(noteFields);
        const noteTags = note.tags.trim().split(/\s+/).filter((t) => t.length > 0);
        setTags(noteTags);
        
        // Get the deck from the first card of this note
        const cards = db.getAllCards().filter(c => c.nid === note.id);
        if (cards.length > 0) {
          setDeckId(cards[0].did);
        }
      }
    } else if (model) {
      // Initialize empty fields for new note
      setFields(new Array(model.flds.length).fill(''));
    }
  }, [noteId]);

  const handleFieldChange = (index: number, value: string) => {
    const newFields = [...fields];
    // Convert base64 images back to filename references for storage
    let cleanedValue = value.replace(
      /<img([^>]+)data-filename="([^"]+)"([^>]*)>/gi,
      '<img src="$2" />'
    );
    // Also strip any remaining file:// paths
    cleanedValue = cleanedValue.replace(
      /<img([^>]+)src="file:\/\/[^"]*\/([^"\/]+)"([^>]*)>/gi,
      '<img src="$2" />'
    );
    newFields[index] = cleanedValue;
    setFields(newFields);
  };

  const handleFieldSelectionChange = (index: number, selection: { start: number; end: number }) => {
    setFieldSelections((prev) => ({ ...prev, [index]: selection }));
  };

  const handleInsertImage = (fieldIndex: number) => {
    setMediaType('image');
    setMediaPickerVisible(true);
  };

  const handleInsertAudio = (fieldIndex: number) => {
    setMediaType('audio');
    setMediaPickerVisible(true);
  };

  const handleInsertCloze = (fieldIndex: number) => {
    const editorRef = editorRefs.current[fieldIndex];
    if (editorRef) {
      editorRef.insertCloze();
    }
  };

  const handleMediaSelected = async (uri: string, filename: string) => {
    // Close the sheet first to prevent crashes
    setMediaPickerVisible(false);
    
    try {
      const media = await mediaService.addMediaFile(uri, filename);
      
      // Insert media into current field using editor ref
      const editorRef = editorRefs.current[currentFieldIndex];
      if (editorRef) {
        if (mediaType === 'image') {
          editorRef.insertImage(media.filename);
        } else {
          editorRef.insertAudio(media.filename);
        }
      }
    } catch (error) {
      logger.error('[NoteEditor] Error adding media:', error);
      Alert.alert('Error', `Failed to add media: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleSave = async () => {
    if (!model) {
      Alert.alert('Error', 'Model not found');
      return;
    }

    // Validate required fields
    const hasContent = fields.some((f) => f.trim().length > 0);
    if (!hasContent) {
      Alert.alert('Error', 'At least one field must have content');
      return;
    }

    setIsSaving(true);

    try {
      if (noteId) {
        // Update existing note
        noteService.updateNote(noteId, { fields, tags });
      } else {
        // Create new note
        noteService.createNote({
          modelId,
          deckId,
          fields,
          tags,
        });
      }

      await PersistenceService.save(db);
      
      // Reload scheduler to pick up changes (new cards, updated counts)
      reload();
      
      // Note: SearchIndex will reindex when CardBrowser screen is focused
      // via useFocusEffect hook we added earlier
      
      Alert.alert('Success', noteId ? 'Note updated' : 'Note created', [
        {
          text: 'OK',
          onPress: () => navigation?.goBack?.(),
        },
      ]);
    } catch (error) {
      logger.error('[NoteEditor] Error saving:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to save note');
    } finally {
      setIsSaving(false);
    }
  };

  if (!model) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]}>
        <Text style={[styles.errorText, { color: theme.colors.danger }]}>
          Model not found
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]} edges={['top']}>
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? -10 : 0}
      >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <Pressable 
          onPress={() => navigation?.goBack?.()} 
          style={styles.headerButton}
        >
          <Ionicons name="close" size={28} color={theme.colors.textPrimary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>
            {getCurrentCardType() === 'cloze' 
              ? (currentFieldIndex === 0 ? 'Text' : 'Extra')
              : (currentFieldIndex === 0 ? 'Front' : 'Back')}
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>
            {currentFieldIndex + 1} of {model?.flds.length || 0}
          </Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      {/* Card Type Selector - Only show for new notes */}
      {!noteId && (
        <View style={[styles.cardTypeSelector, { backgroundColor: theme.colors.bg, borderBottomColor: theme.colors.border }]}>
          <Text style={[styles.cardTypeLabel, { color: theme.colors.textSecondary }]}>Card Type</Text>
          <Pressable
            style={[styles.cardTypeDropdown, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
            onPress={() => {
              if (Platform.OS === 'ios') {
                ActionSheetIOS.showActionSheetWithOptions(
                  {
                    options: ['Cancel', 'Basic (Front & Back)', 'Cloze (Fill in the Blank)', 'Image Occlusion'],
                    cancelButtonIndex: 0,
                  },
                  (buttonIndex) => {
                    if (buttonIndex === 1) handleCardTypeChange('basic');
                    else if (buttonIndex === 2) handleCardTypeChange('cloze');
                    else if (buttonIndex === 3) handleCardTypeChange('image-occlusion');
                  }
                );
              } else {
                Alert.alert(
                  'Select Card Type',
                  'Choose the type of card you want to create',
                  [
                    {
                      text: 'Basic (Front & Back)',
                      onPress: () => handleCardTypeChange('basic'),
                    },
                    {
                      text: 'Cloze (Fill in the Blank)',
                      onPress: () => handleCardTypeChange('cloze'),
                    },
                    {
                      text: 'Image Occlusion',
                      onPress: () => handleCardTypeChange('image-occlusion'),
                    },
                    {
                      text: 'Cancel',
                      style: 'cancel',
                    },
                  ]
                );
              }
            }}
          >
            <View style={styles.cardTypeDropdownContent}>
              <Ionicons 
                name={
                  getCurrentCardType() === 'basic' ? 'card-outline' : 
                  getCurrentCardType() === 'cloze' ? 'eye-off-outline' : 
                  'image-outline'
                } 
                size={22} 
                color={theme.colors.textPrimary} 
              />
              <Text style={[styles.cardTypeDropdownText, { color: theme.colors.textPrimary }]}>
                {getCurrentCardType() === 'basic' ? 'Basic (Front & Back)' : 
                 getCurrentCardType() === 'cloze' ? 'Cloze (Fill in the Blank)' : 
                 'Image Occlusion'}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={20} color={theme.colors.textSecondary} />
          </Pressable>
        </View>
      )}

      {/* Current Field Editor - Scrollable */}
      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.editorScrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={true}
        bounces={true}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.editorWrapper}>
            <WYSIWYGEditor
              key={`${noteId || 'new'}-${currentFieldIndex}`}
              ref={(ref) => {
                editorRefs.current[currentFieldIndex] = ref;
              }}
              value={fields[currentFieldIndex] || ''}
              onChangeText={(value: string) => handleFieldChange(currentFieldIndex, value)}
              placeholder={
                getCurrentCardType() === 'cloze' && currentFieldIndex === 0
                  ? 'Example: The capital of France is {{c1::Paris}}'
                  : getCurrentCardType() === 'cloze' && currentFieldIndex === 1
                  ? 'Optional extra information...'
                  : `Enter ${currentFieldIndex === 0 ? 'question' : 'answer'}...`
              }
              onInsertImage={() => handleInsertImage(currentFieldIndex)}
              onInsertAudio={() => handleInsertAudio(currentFieldIndex)}
              onInsertCloze={model.type === MODEL_TYPE_CLOZE ? () => handleInsertCloze(currentFieldIndex) : undefined}
              multiline
            />
          </View>
        </TouchableWithoutFeedback>
      </ScrollView>

      {/* Navigation Footer - Dismisses keyboard on press */}
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={[styles.footer, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }]}>
        <Pressable
          style={[styles.navButton, { opacity: currentFieldIndex === 0 ? 0.5 : 1 }]}
          onPress={() => currentFieldIndex > 0 && setCurrentFieldIndex(currentFieldIndex - 1)}
          disabled={currentFieldIndex === 0}
        >
          <Ionicons name="chevron-back" size={24} color={theme.colors.textPrimary} />
          <Text style={[styles.navButtonText, { color: theme.colors.textPrimary }]}>Previous</Text>
        </Pressable>

        {currentFieldIndex < (model?.flds.length || 1) - 1 ? (
          <Pressable
            style={[styles.navButton, styles.nextButton, { backgroundColor: theme.colors.accent }]}
            onPress={() => setCurrentFieldIndex(currentFieldIndex + 1)}
          >
            <Text style={[styles.navButtonText, { color: '#000' }]}>Next</Text>
            <Ionicons name="chevron-forward" size={24} color="#000" />
          </Pressable>
        ) : (
          <Pressable
            style={[styles.navButton, styles.saveButtonBottom, { backgroundColor: theme.colors.success }]}
            onPress={handleSave}
            disabled={isSaving}
          >
            <Ionicons name="checkmark" size={24} color="#FFF" />
            <Text style={[styles.navButtonText, { color: '#FFF' }]}>{isSaving ? 'Saving...' : 'Save Note'}</Text>
          </Pressable>
        )}
        </View>
      </TouchableWithoutFeedback>

      {/* Hidden - Tags section removed for now */}

      {/* Media Picker */}
      <MediaPickerSheet
        visible={mediaPickerVisible}
        type={mediaType}
        onMediaSelected={handleMediaSelected}
        onClose={() => setMediaPickerVisible(false)}
      />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: s.lg,
    paddingVertical: s.md,
    borderBottomWidth: 1,
  },
  headerButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: '500',
  },
  saveButton: {
    width: 44,
    height: 44,
    borderRadius: r.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  editorScrollContent: {
    flexGrow: 1,
    padding: s.lg,
    paddingBottom: 300, // Large bottom padding so content scrolls above keyboard
  },
  editorWrapper: {
    minHeight: 600, // Tall enough to ensure scrollability
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: s.lg,
    paddingVertical: s.md,
    paddingBottom: s.xl,
    borderTopWidth: 1,
    gap: s.md,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: s.md,
    paddingHorizontal: s.lg,
    borderRadius: r.md,
    gap: s.xs,
  },
  navButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  nextButton: {
    flex: 1,
  },
  saveButtonBottom: {
    flex: 1,
  },
  fieldContainer: {
    gap: s.md,
  },
  fieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: s.xs,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  requiredBadge: {
    paddingHorizontal: s.sm,
    paddingVertical: 2,
    borderRadius: r.sm,
  },
  requiredText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tagsSection: {
    display: 'none',
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    padding: s.xl,
  },
  cardTypeSelector: {
    paddingHorizontal: s.lg,
    paddingVertical: s.md,
    borderBottomWidth: 1,
  },
  cardTypeLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: s.sm,
  },
  cardTypeDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: s.md,
    paddingHorizontal: s.md,
    borderRadius: r.md,
    borderWidth: 1,
  },
  cardTypeDropdownContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.sm,
    flex: 1,
  },
  cardTypeDropdownText: {
    fontSize: 16,
    fontWeight: '500',
  },
});
