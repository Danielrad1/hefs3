/**
 * NoteEditorScreen - Edit note fields, tags, and preview cards
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../design/theme';
import { s } from '../../design/spacing';
import { r } from '../../design/radii';
import { db } from '../../services/anki/InMemoryDb';
import { NoteService } from '../../services/anki/NoteService';
import { MediaService } from '../../services/anki/MediaService';
import { ClozeService } from '../../services/anki/ClozeService';
import { PersistenceService } from '../../services/anki/PersistenceService';
import { useScheduler } from '../../context/SchedulerProvider';
import RichTextEditor from './components/RichTextEditor';
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
    console.warn('[NoteEditor] No models found! Falling back to "1"');
    return '1'; // Fallback to Basic if no models exist
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

  const handleInsertImage = () => {
    setMediaType('image');
    setMediaPickerVisible(true);
  };

  const handleInsertAudio = () => {
    setMediaType('audio');
    setMediaPickerVisible(true);
  };

  const handleMediaSelected = async (uri: string, filename: string) => {
    try {
      const media = await mediaService.addMediaFile(uri, filename);
      
      // Insert media reference into active field
      const mediaTag =
        mediaType === 'image'
          ? `<img src="${media.filename}" />`
          : `[sound:${media.filename}]`;
      
      const currentValue = fields[activeFieldIndex] || '';
      handleFieldChange(activeFieldIndex, currentValue + mediaTag);
      
      Alert.alert('Success', 'Media added to field');
    } catch (error) {
      console.error('[NoteEditor] Error adding media:', error);
      Alert.alert('Error', 'Failed to add media');
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
      <View style={styles.header}>
        <Pressable onPress={() => navigation?.goBack?.()}>
          <Text style={[styles.headerButton, { color: theme.colors.accent }]}>Cancel</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>
          {noteId ? 'Edit Note' : 'Add Note'}
        </Text>
        <Pressable onPress={handleSave} disabled={isSaving}>
          <Text
            style={[
              styles.headerButton,
              { color: isSaving ? theme.colors.textSecondary : theme.colors.accent },
            ]}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Text>
        </Pressable>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Deck and Model info */}
        <View style={[styles.infoCard, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>Deck</Text>
          <Text style={[styles.infoValue, { color: theme.colors.textPrimary }]}>
            {deck?.name || 'Unknown'}
          </Text>
          <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>Type</Text>
          <Text style={[styles.infoValue, { color: theme.colors.textPrimary }]}>
            {model.name}
          </Text>
        </View>

        {/* Fields */}
        {model.flds.map((field, index) => (
          <View key={index} style={styles.fieldContainer}>
            <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary }]}>
              {field.name}
              {index === 0 && ' (required)'}
            </Text>
            <RichTextEditor
              value={fields[index] || ''}
              onChangeText={(value) => handleFieldChange(index, value)}
              placeholder={`Enter ${field.name.toLowerCase()}...`}
              onInsertImage={handleInsertImage}
              onInsertAudio={handleInsertAudio}
              onInsertCloze={model.type === MODEL_TYPE_CLOZE ? () => {
                // Use ClozeService to insert cloze properly
                const currentValue = fields[index] || '';
                const selection = fieldSelections[index] || { start: currentValue.length, end: currentValue.length };
                const result = clozeService.insertCloze(currentValue, selection);
                handleFieldChange(index, result.html);
              } : undefined}
              onSelectionChange={(sel) => handleFieldSelectionChange(index, sel)}
              multiline
              style={{ marginTop: s.sm }}
            />
          </View>
        ))}

        {/* Tags */}
        <View style={styles.tagsContainer}>
          <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>Tags</Text>
          <View style={styles.tagsInputRow}>
            <TextInput
              style={[
                styles.tagInput,
                {
                  backgroundColor: theme.colors.surface,
                  color: theme.colors.textPrimary,
                  borderColor: theme.colors.border,
                },
              ]}
              value={tagInput}
              onChangeText={setTagInput}
              placeholder="Add tag..."
              placeholderTextColor={theme.colors.textSecondary}
              onSubmitEditing={handleAddTag}
            />
            <Pressable
              style={[styles.addTagButton, { backgroundColor: theme.colors.accent }]}
              onPress={handleAddTag}
            >
              <Text style={styles.addTagButtonText}>+</Text>
            </Pressable>
          </View>
          <View style={styles.tagsChips}>
            {tags.map((tag) => (
              <Pressable
                key={tag}
                style={[styles.tagChip, { backgroundColor: theme.colors.surface }]}
                onPress={() => handleRemoveTag(tag)}
              >
                <Text style={[styles.tagChipText, { color: theme.colors.textPrimary }]}>
                  {tag}
                </Text>
                <Text style={[styles.tagChipClose, { color: theme.colors.textSecondary }]}>
                  ×
                </Text>
              </Pressable>
            ))}
          </View>
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
    padding: s.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  headerButton: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: s.lg,
    gap: s.lg,
  },
  infoCard: {
    padding: s.md,
    borderRadius: r.md,
    gap: s.xs,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  infoValue: {
    fontSize: 16,
    marginBottom: s.sm,
  },
  fieldContainer: {
    gap: s.sm,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: s.sm,
  },
  tagsContainer: {
    gap: s.sm,
  },
  tagsInputRow: {
    flexDirection: 'row',
    gap: s.sm,
  },
  tagInput: {
    flex: 1,
    padding: s.md,
    borderRadius: r.md,
    borderWidth: 1,
    fontSize: 16,
  },
  addTagButton: {
    width: 44,
    height: 44,
    borderRadius: r.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addTagButtonText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#000',
  },
  tagsChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: s.sm,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: s.xs,
    paddingHorizontal: s.md,
    borderRadius: r.pill,
    gap: s.xs,
  },
  tagChipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  tagChipClose: {
    fontSize: 20,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    padding: s.xl,
  },
});
