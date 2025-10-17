import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/theme';
import { s } from '../../design/spacing';
import { r } from '../../design/radii';
import { GeneratedNote, NoteModel } from '../../services/ai/types';
import { DeckService } from '../../services/anki/DeckService';
import { NoteService } from '../../services/anki/NoteService';
import { db } from '../../services/anki/InMemoryDb';
import { PersistenceService } from '../../services/anki/PersistenceService';
import { DEFAULT_MODEL_ID } from '../../services/anki/schema';
import { useScheduler } from '../../context/SchedulerProvider';
import { logger } from '../../utils/logger';

interface RouteParams {
  deckName: string;
  noteModel: NoteModel;
  notes: GeneratedNote[];
  metadata: {
    modelUsed: string;
    items: number;
  };
}

export default function AIDeckPreviewScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute();
  const params = route.params as RouteParams;

  const [deckName, setDeckName] = useState(params.deckName);
  const [notes, setNotes] = useState<GeneratedNote[]>(params.notes);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const { reload } = useScheduler();
  const deckService = React.useMemo(() => new DeckService(db), []);
  const noteService = React.useMemo(() => new NoteService(db), []);
  
  // Use ref instead of state to avoid closure issues
  const createdDeckIdRef = React.useRef<string | null>(null);
  const deckSavedRef = React.useRef(false);

  // Cleanup: if user navigates away without saving, remove the deck
  React.useEffect(() => {
    return () => {
      const deckId = createdDeckIdRef.current;
      const isSaved = deckSavedRef.current;
      
      logger.info('[AIDeckPreview] Cleanup check:', { deckId, isSaved });
      
      if (deckId && !isSaved) {
        logger.info('[AIDeckPreview] Cleaning up unsaved deck:', deckId);
        // Fire and forget - cleanup happens in background
        deckService.deleteDeck(deckId, { deleteCards: true }).catch((error) => {
          logger.error('[AIDeckPreview] Cleanup error:', error);
        });
      } else if (deckId && isSaved) {
        logger.info('[AIDeckPreview] Deck was saved, skipping cleanup');
      }
    };
  }, [deckService]);

  const handleEditNote = (index: number) => {
    setEditingIndex(editingIndex === index ? null : index);
  };

  const handleUpdateNote = (index: number, updates: Partial<GeneratedNote>) => {
    const updated = [...notes];
    updated[index] = { ...updated[index], ...updates };
    setNotes(updated);
  };

  const handleDeleteNote = (index: number) => {
    Alert.alert('Delete Note', 'Remove this card?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          const updated = notes.filter((_, i) => i !== index);
          setNotes(updated);
          if (editingIndex === index) {
            setEditingIndex(null);
          }
        },
      },
    ]);
  };

  const handleCreateDeck = async () => {
    if (!deckName.trim()) {
      Alert.alert('Error', 'Deck name is required');
      return;
    }

    if (notes.length === 0) {
      Alert.alert('Error', 'No notes to create');
      return;
    }

    logger.info('[AIDeckPreview] Starting deck creation:', {
      deckName: deckName.trim(),
      noteCount: notes.length,
      noteModel: params.noteModel,
    });

    setIsCreating(true);

    try {
      // Create deck
      logger.info('[AIDeckPreview] Creating deck...');
      const deck = deckService.createDeck(deckName.trim());
      createdDeckIdRef.current = deck.id; // Track for cleanup if needed
      logger.info('[AIDeckPreview] Deck created:', { id: deck.id, name: deck.name });

      // Determine model ID
      // Cloze model has ID 2, Basic model has ID 1
      const modelId = params.noteModel === 'cloze' ? 2 : DEFAULT_MODEL_ID;
      logger.info('[AIDeckPreview] Using model ID:', modelId, 'for', params.noteModel);

      // Create notes
      let createdCount = 0;
      let skippedCount = 0;

      for (let i = 0; i < notes.length; i++) {
        const note = notes[i];
        logger.info(`[AIDeckPreview] Processing note ${i + 1}/${notes.length}`);

        if (params.noteModel === 'basic') {
          if (!note.front || !note.back) {
            logger.info(`[AIDeckPreview] Skipping invalid basic note ${i}:`, { 
              hasFront: !!note.front, 
              hasBack: !!note.back 
            });
            skippedCount++;
            continue;
          }

          logger.info(`[AIDeckPreview] Creating basic note ${i}:`, {
            frontLength: note.front.length,
            backLength: note.back.length,
            tags: note.tags,
          });

          const createdNote = noteService.createNote({
            modelId,
            deckId: deck.id,
            fields: [note.front.trim(), note.back.trim()],
            tags: ['ai', 'ai:generated', ...(note.tags || [])],
          });

          logger.info(`[AIDeckPreview] Basic note created:`, { noteId: createdNote.id });
          createdCount++;
        } else {
          if (!note.cloze) {
            logger.info(`[AIDeckPreview] Skipping invalid cloze note ${i}`);
            skippedCount++;
            continue;
          }

          logger.info(`[AIDeckPreview] Creating cloze note ${i}:`, {
            clozeLength: note.cloze.length,
            tags: note.tags,
          });

          // Cloze model has 2 fields: Text and Extra
          const createdNote = noteService.createNote({
            modelId,
            deckId: deck.id,
            fields: [note.cloze.trim(), ''], // Text field and empty Extra field
            tags: ['ai', 'ai:generated', ...(note.tags || [])],
          });

          logger.info(`[AIDeckPreview] Cloze note created:`, { noteId: createdNote.id });
          createdCount++;
        }
      }

      logger.info('[AIDeckPreview] Note creation summary:', {
        total: notes.length,
        created: createdCount,
        skipped: skippedCount,
      });

      // Save to persistence
      logger.info('[AIDeckPreview] Saving to persistence...');
      await PersistenceService.save(db);
      logger.info('[AIDeckPreview] Persistence save complete');

      // Verify cards were created
      const cards = db.getCardsByDeck(deck.id);
      logger.info('[AIDeckPreview] Verification - cards in deck:', cards.length);

      // Mark as successfully saved (no cleanup needed)
      deckSavedRef.current = true;
      logger.info('[AIDeckPreview] Marked deck as saved');

      // Reload scheduler to pick up new deck
      logger.info('[AIDeckPreview] Reloading scheduler...');
      await reload();
      logger.info('[AIDeckPreview] Scheduler reload complete');

      // Verify deck is now in scheduler
      const verifyDeck = db.getDeck(deck.id);
      logger.info('[AIDeckPreview] Deck verification:', verifyDeck ? 'Found' : 'NOT FOUND');

      // Automatically navigate to deck detail
      logger.info('[AIDeckPreview] Auto-navigating to deck detail');
      navigation.reset({
        index: 1,
        routes: [
          { name: 'DecksList' },
          { name: 'DeckDetail', params: { deckId: deck.id } },
        ],
      });
    } catch (error) {
      logger.error('[AIDeckPreview] Create deck error:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to create deck');
    } finally {
      setIsCreating(false);
    }
  };

  const renderBasicNote = (note: GeneratedNote, index: number) => {
    const isEditing = editingIndex === index;

    return (
      <View
        key={index}
        style={[styles.noteCard, { backgroundColor: theme.colors.surface }]}
      >
        <View style={styles.noteHeader}>
          <Text style={[styles.noteNumber, { color: theme.colors.textSecondary }]}>
            Card {index + 1}
          </Text>
          <View style={styles.noteActions}>
            <Pressable onPress={() => handleEditNote(index)} style={styles.actionButton}>
              <Ionicons
                name={isEditing ? 'checkmark' : 'create-outline'}
                size={20}
                color={theme.colors.accent}
              />
            </Pressable>
            <Pressable onPress={() => handleDeleteNote(index)} style={styles.actionButton}>
              <Ionicons name="trash-outline" size={20} color={theme.colors.danger} />
            </Pressable>
          </View>
        </View>

        {isEditing ? (
          <View style={styles.editContainer}>
            <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary }]}>Front</Text>
            <TextInput
              style={[
                styles.editInput,
                { backgroundColor: theme.colors.bg, color: theme.colors.textPrimary },
              ]}
              value={note.front}
              onChangeText={(text) => handleUpdateNote(index, { front: text })}
              multiline
              placeholder="Front of card"
              placeholderTextColor={theme.colors.textSecondary}
            />
            <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary }]}>Back</Text>
            <TextInput
              style={[
                styles.editInput,
                { backgroundColor: theme.colors.bg, color: theme.colors.textPrimary },
              ]}
              value={note.back}
              onChangeText={(text) => handleUpdateNote(index, { back: text })}
              multiline
              placeholder="Back of card"
              placeholderTextColor={theme.colors.textSecondary}
            />
          </View>
        ) : (
          <View style={styles.viewContainer}>
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary }]}>Front</Text>
              <Text style={[styles.fieldText, { color: theme.colors.textPrimary }]}>
                {note.front}
              </Text>
            </View>
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary }]}>Back</Text>
              <Text style={[styles.fieldText, { color: theme.colors.textPrimary }]}>
                {note.back}
              </Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  const renderClozeNote = (note: GeneratedNote, index: number) => {
    const isEditing = editingIndex === index;

    return (
      <View
        key={index}
        style={[styles.noteCard, { backgroundColor: theme.colors.surface }]}
      >
        <View style={styles.noteHeader}>
          <Text style={[styles.noteNumber, { color: theme.colors.textSecondary }]}>
            Card {index + 1}
          </Text>
          <View style={styles.noteActions}>
            <Pressable onPress={() => handleEditNote(index)} style={styles.actionButton}>
              <Ionicons
                name={isEditing ? 'checkmark' : 'create-outline'}
                size={20}
                color={theme.colors.accent}
              />
            </Pressable>
            <Pressable onPress={() => handleDeleteNote(index)} style={styles.actionButton}>
              <Ionicons name="trash-outline" size={20} color={theme.colors.danger} />
            </Pressable>
          </View>
        </View>

        {isEditing ? (
          <View style={styles.editContainer}>
            <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary }]}>
              Cloze Text
            </Text>
            <TextInput
              style={[
                styles.editInput,
                styles.clozeInput,
                { backgroundColor: theme.colors.bg, color: theme.colors.textPrimary },
              ]}
              value={note.cloze}
              onChangeText={(text) => handleUpdateNote(index, { cloze: text })}
              multiline
              placeholder="Use {{c1::answer}} syntax"
              placeholderTextColor={theme.colors.textSecondary}
            />
          </View>
        ) : (
          <View style={styles.viewContainer}>
            <Text style={[styles.clozeText, { color: theme.colors.textPrimary }]}>
              {note.cloze}
            </Text>
          </View>
        )}
      </View>
    );
  };

  const handleCancel = () => {
    Alert.alert(
      'Discard Deck?',
      'This deck will not be saved. You can always generate it again later.',
      [
        { text: 'Keep Editing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            // Navigate back to DecksList, clearing all AI screens
            navigation.reset({
              index: 0,
              routes: [{ name: 'DecksList' }],
            });
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={handleCancel} style={styles.backButton}>
          <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
        </Pressable>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
          Preview Deck
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Deck Name */}
      <View style={styles.deckNameContainer}>
        <TextInput
          style={[styles.deckNameInput, { color: theme.colors.textPrimary }]}
          value={deckName}
          onChangeText={setDeckName}
          placeholder="Deck name"
          placeholderTextColor={theme.colors.textSecondary}
        />
        <Text style={[styles.metaText, { color: theme.colors.textSecondary }]}>
          {notes.length} cards • {params.noteModel === 'basic' ? 'Basic' : 'Cloze'}
        </Text>
      </View>

      {/* Notes List */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {notes.map((note, index) =>
          params.noteModel === 'basic'
            ? renderBasicNote(note, index)
            : renderClozeNote(note, index)
        )}

        {notes.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
              No cards to preview
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Create Button */}
      <View style={[styles.footer, { backgroundColor: theme.colors.bg, borderTopColor: theme.colors.border }]}>
        <Pressable
          style={[
            styles.createButton,
            { backgroundColor: theme.colors.accent },
            (isCreating || notes.length === 0) && { opacity: 0.6 },
          ]}
          onPress={handleCreateDeck}
          disabled={isCreating || notes.length === 0}
        >
          {isCreating ? (
            <>
              <ActivityIndicator color="#000" />
              <Text style={styles.createButtonText}>Creating...</Text>
            </>
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#000" />
              <Text style={styles.createButtonText}>Create Deck ({notes.length})</Text>
            </>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: s.lg,
    paddingVertical: s.md,
  },
  backButton: {
    padding: s.xs,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  deckNameContainer: {
    paddingHorizontal: s.lg,
    paddingBottom: s.md,
    gap: s.xs,
  },
  deckNameInput: {
    fontSize: 24,
    fontWeight: '700',
  },
  metaText: {
    fontSize: 14,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: s.lg,
    gap: s.md,
  },
  noteCard: {
    borderRadius: r.lg,
    padding: s.md,
    gap: s.md,
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  noteNumber: {
    fontSize: 14,
    fontWeight: '600',
  },
  noteActions: {
    flexDirection: 'row',
    gap: s.md,
  },
  actionButton: {
    padding: s.xs,
  },
  viewContainer: {
    gap: s.md,
  },
  editContainer: {
    gap: s.sm,
  },
  fieldContainer: {
    gap: s.xs / 2,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  fieldText: {
    fontSize: 16,
    lineHeight: 22,
  },
  editInput: {
    borderRadius: r.md,
    padding: s.sm,
    fontSize: 16,
    minHeight: 60,
  },
  clozeInput: {
    minHeight: 100,
  },
  clozeText: {
    fontSize: 16,
    lineHeight: 22,
    fontFamily: 'monospace',
  },
  emptyState: {
    padding: s.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
  },
  footer: {
    padding: s.lg,
    borderTopWidth: 1,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: s.md,
    borderRadius: r.md,
    gap: s.sm,
  },
  createButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
  },
});
