/**
 * NoteEditorScreen - Edit note fields, tags, and preview cards
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert, TextInput } from 'react-native';
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

export default function NoteEditorScreen({ route, navigation }: NoteEditorScreenProps) {
  const theme = useTheme();
  const { reload } = useScheduler();
  const noteId = route?.params?.noteId;
  
  // Smart default: use first available model if modelId not provided
  const getDefaultModelId = () => {
    console.log('[NoteEditor] Route params:', route?.params);
    if (route?.params?.modelId) {
      console.log('[NoteEditor] Using modelId from route:', route.params.modelId);
      return route.params.modelId;
    }
    const models = db.getAllModels();
    console.log('[NoteEditor] Available models:', models.map(m => ({ id: m.id, name: m.name })));
    if (models.length > 0) {
      console.log('[NoteEditor] Using first model:', models[0].id, models[0].name);
      return models[0].id;
    }
    console.warn('[NoteEditor] No models found! Falling back to 1');
    return 1; // Fallback to Basic if no models exist (numeric ID)
  };
  
  const getDefaultDeckId = () => {
    if (route?.params?.deckId) return route.params.deckId;
    const decks = db.getAllDecks().filter(d => d.id !== '1'); // Exclude Default deck
    if (decks.length > 0) return decks[0].id;
    return '1'; // Fallback to Default if no other decks
  };

  const [noteService] = useState(() => new NoteService(db));
  const [mediaService] = useState(() => new MediaService(db));
  const [clozeService] = useState(() => new ClozeService());
  
  const [modelId, setModelId] = useState(getDefaultModelId());
  const [deckId, setDeckId] = useState(getDefaultDeckId());
  const [fields, setFields] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [activeFieldIndex, setActiveFieldIndex] = useState(0);
  const [fieldSelections, setFieldSelections] = useState<Record<number, { start: number; end: number }>>({});
  const [mediaPickerVisible, setMediaPickerVisible] = useState(false);
  const [mediaType, setMediaType] = useState<MediaType>('image');
  const [isSaving, setIsSaving] = useState(false);
  const editorRefs = React.useRef<Record<number, WYSIWYGEditorRef | null>>({});

  const model = db.getModel(modelId);
  const deck = db.getDeck(deckId);
  
  console.log('[NoteEditor] Selected modelId:', modelId);
  console.log('[NoteEditor] Model found:', model ? `${model.name} (${model.id})` : 'NULL');

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
    newFields[index] = value;
    setFields(newFields);
  };

  const handleFieldSelectionChange = (index: number, selection: { start: number; end: number }) => {
    setFieldSelections((prev) => ({ ...prev, [index]: selection }));
  };

  const handleInsertImage = (fieldIndex: number) => {
    setActiveFieldIndex(fieldIndex);
    setMediaType('image');
    setMediaPickerVisible(true);
  };

  const handleInsertAudio = (fieldIndex: number) => {
    setActiveFieldIndex(fieldIndex);
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
    console.log('[NoteEditor] handleMediaSelected called with:', { uri, filename, mediaType });
    
    // Close the sheet first to prevent crashes
    setMediaPickerVisible(false);
    
    try {
      console.log('[NoteEditor] Adding media file...');
      const media = await mediaService.addMediaFile(uri, filename);
      console.log('[NoteEditor] Media added successfully:', media);
      
      // Insert media into active field using editor ref
      const editorRef = editorRefs.current[activeFieldIndex];
      if (editorRef) {
        console.log('[NoteEditor] Inserting into editor, field index:', activeFieldIndex);
        if (mediaType === 'image') {
          editorRef.insertImage(media.filename);
        } else {
          editorRef.insertAudio(media.filename);
        }
        console.log('[NoteEditor] Media inserted successfully');
      } else {
        console.warn('[NoteEditor] No editor ref found for index:', activeFieldIndex);
      }
    } catch (error) {
      console.error('[NoteEditor] Error adding media:', error);
      console.error('[NoteEditor] Error stack:', error instanceof Error ? error.stack : 'No stack');
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
      console.error('[NoteEditor] Error saving:', error);
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
            {noteId ? 'Edit Note' : 'Create Note'}
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>
            {model?.name || ''}
          </Text>
        </View>
        <Pressable 
          onPress={handleSave} 
          disabled={isSaving}
          style={[styles.saveButton, { backgroundColor: isSaving ? theme.colors.border : theme.colors.accent }]}
        >
          {isSaving ? (
            <Ionicons name="hourglass-outline" size={20} color="#000" />
          ) : (
            <Ionicons name="checkmark" size={20} color="#000" />
          )}
        </Pressable>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Fields */}
        {model.flds.map((field, index) => (
          <View key={index} style={styles.fieldContainer}>
            <View style={styles.fieldHeader}>
              <Text style={[styles.fieldLabel, { color: theme.colors.textPrimary }]}>
                {field.name}
              </Text>
              {index === 0 && (
                <View style={[styles.requiredBadge, { backgroundColor: theme.colors.danger + '20' }]}>
                  <Text style={[styles.requiredText, { color: theme.colors.danger }]}>Required</Text>
                </View>
              )}
            </View>
            <WYSIWYGEditor
              ref={(ref) => {
                editorRefs.current[index] = ref;
              }}
              value={fields[index] || ''}
              onChangeText={(value: string) => handleFieldChange(index, value)}
              placeholder={`Enter ${field.name.toLowerCase()}...`}
              onInsertImage={() => handleInsertImage(index)}
              onInsertAudio={() => handleInsertAudio(index)}
              onInsertCloze={model.type === MODEL_TYPE_CLOZE ? () => handleInsertCloze(index) : undefined}
              multiline
            />
          </View>
        ))}

        {/* Tags */}
        <View style={styles.tagsSection}>
          <View style={styles.sectionHeader}>
            <Ionicons name="pricetag-outline" size={20} color={theme.colors.accent} />
            <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>Tags</Text>
            <Text style={[styles.tagCount, { color: theme.colors.textSecondary }]}>({tags.length})</Text>
          </View>
          <View style={styles.tagsInputRow}>
            <View style={[styles.tagInputContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <Ionicons name="add-circle-outline" size={20} color={theme.colors.textSecondary} />
              <TextInput
                style={[styles.tagInput, { color: theme.colors.textPrimary }]}
                value={tagInput}
                onChangeText={setTagInput}
                placeholder="Add tag..."
                placeholderTextColor={theme.colors.textSecondary}
                onSubmitEditing={handleAddTag}
              />
            </View>
            <Pressable
              style={[styles.addTagButton, { backgroundColor: theme.colors.accent }]}
              onPress={handleAddTag}
            >
              <Ionicons name="add" size={24} color="#000" />
            </Pressable>
          </View>
          {tags.length > 0 && (
            <View style={styles.tagsChips}>
              {tags.map((tag) => (
                <Pressable
                  key={tag}
                  style={[styles.tagChip, { backgroundColor: theme.colors.accent + '15', borderColor: theme.colors.accent + '40' }]}
                  onPress={() => handleRemoveTag(tag)}
                >
                  <Ionicons name="pricetag" size={14} color={theme.colors.accent} />
                  <Text style={[styles.tagChipText, { color: theme.colors.textPrimary }]}>
                    {tag}
                  </Text>
                  <Ionicons name="close-circle" size={16} color={theme.colors.textSecondary} />
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Media Picker */}
      <MediaPickerSheet
        visible={mediaPickerVisible}
        type={mediaType}
        onMediaSelected={handleMediaSelected}
        onClose={() => setMediaPickerVisible(false)}
      />
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
  contentContainer: {
    padding: s.lg,
    gap: s.lg,
    paddingBottom: s.xl * 2,
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
    gap: s.md,
    marginTop: s.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  tagCount: {
    fontSize: 14,
    fontWeight: '600',
  },
  tagsInputRow: {
    flexDirection: 'row',
    gap: s.sm,
  },
  tagInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: s.md,
    borderRadius: r.md,
    borderWidth: 1,
    gap: s.sm,
  },
  tagInput: {
    flex: 1,
    paddingVertical: s.md,
    fontSize: 16,
  },
  addTagButton: {
    width: 48,
    height: 48,
    borderRadius: r.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tagsChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: s.sm,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: s.sm,
    paddingHorizontal: s.md,
    borderRadius: r.pill,
    borderWidth: 1,
    gap: s.xs,
  },
  tagChipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    padding: s.xl,
  },
});
