/**
 * CardCreatorScreen - Universal card creation screen with type selector
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/theme';
import { s } from '../../design/spacing';
import { r } from '../../design/radii';
import { db } from '../../services/anki/InMemoryDb';
import { NoteService } from '../../services/anki/NoteService';
import { logger } from '../../utils/logger';

interface CardCreatorScreenProps {
  route: {
    params: {
      deckId: string;
    };
  };
  navigation: any;
}

type CardType = 'basic' | 'cloze' | 'image-occlusion';

export default function CardCreatorScreen({ route, navigation }: CardCreatorScreenProps) {
  const theme = useTheme();
  const { deckId } = route.params;
  const [cardType, setCardType] = useState<CardType>('basic');
  const [frontText, setFrontText] = useState('');
  const [backText, setBackText] = useState('');
  const [clozeText, setClozeText] = useState('');

  const noteService = new NoteService(db);

  const handleTypeSelect = (type: CardType) => {
    setCardType(type);
    
    // Navigate to appropriate editor for non-basic types
    if (type === 'image-occlusion') {
      navigation.replace('ImageOcclusionEditor', { deckId });
    }
  };

  const insertCloze = () => {
    const cursorPosition = clozeText.length;
    const clozeNumber = (clozeText.match(/{{c\d+::/g) || []).length + 1;
    const clozeTemplate = `{{c${clozeNumber}::your hidden text goes here}}`;
    
    setClozeText(clozeText + (clozeText ? ' ' : '') + clozeTemplate);
  };

  const handleSave = async () => {
    try {
      if (cardType === 'basic') {
        if (!frontText.trim() || !backText.trim()) {
          Alert.alert('Error', 'Please fill in both front and back fields');
          return;
        }

        // Find Basic model (ID: 1)
        const model = db.getModel(1);
        if (!model) {
          Alert.alert('Error', 'Basic model not found');
          return;
        }

        noteService.createNote({
          modelId: 1,
          deckId,
          fields: [frontText.trim(), backText.trim()],
          tags: [],
        });

        logger.info('[CardCreator] Created basic note');
        Alert.alert('Success', 'Card created successfully', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);

      } else if (cardType === 'cloze') {
        if (!clozeText.trim() || !clozeText.includes('{{c')) {
          Alert.alert('Error', 'Please add at least one cloze deletion');
          return;
        }

        // Find Cloze model (ID: 2)
        const model = db.getModel(2);
        if (!model) {
          Alert.alert('Error', 'Cloze model not found');
          return;
        }

        noteService.createNote({
          modelId: 2,
          deckId,
          fields: [clozeText.trim(), ''],
          tags: [],
        });

        logger.info('[CardCreator] Created cloze note');
        Alert.alert('Success', 'Cloze card(s) created successfully', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      }
    } catch (error) {
      logger.error('[CardCreator] Failed to save:', error);
      Alert.alert('Error', 'Failed to create card');
    }
  };

  const renderBasicEditor = () => (
    <View style={styles.editorContainer}>
      <Text style={[styles.label, { color: theme.colors.textPrimary }]}>Front</Text>
      <TextInput
        style={[styles.textInput, { 
          backgroundColor: theme.colors.surface, 
          color: theme.colors.textPrimary,
          borderColor: theme.colors.border,
        }]}
        value={frontText}
        onChangeText={setFrontText}
        placeholder="Enter question or prompt..."
        placeholderTextColor={theme.colors.textSecondary}
        multiline
        numberOfLines={4}
      />

      <Text style={[styles.label, { color: theme.colors.textPrimary, marginTop: s.lg }]}>Back</Text>
      <TextInput
        style={[styles.textInput, { 
          backgroundColor: theme.colors.surface, 
          color: theme.colors.textPrimary,
          borderColor: theme.colors.border,
        }]}
        value={backText}
        onChangeText={setBackText}
        placeholder="Enter answer..."
        placeholderTextColor={theme.colors.textSecondary}
        multiline
        numberOfLines={4}
      />
    </View>
  );

  const renderClozeEditor = () => (
    <View style={styles.editorContainer}>
      <View style={styles.clozeHeader}>
        <Text style={[styles.label, { color: theme.colors.textPrimary }]}>Text with Cloze Deletions</Text>
        <Pressable
          style={[styles.insertButton, { backgroundColor: theme.colors.accent }]}
          onPress={insertCloze}
        >
          <Ionicons name="add" size={16} color="#000" />
          <Text style={styles.insertButtonText}>Insert Cloze</Text>
        </Pressable>
      </View>
      
      <Text style={[styles.hint, { color: theme.colors.textSecondary }]}>
        Tap "Insert Cloze" to add cloze deletion markers
      </Text>

      <TextInput
        style={[styles.textInput, { 
          backgroundColor: theme.colors.surface, 
          color: theme.colors.textPrimary,
          borderColor: theme.colors.border,
          minHeight: 150,
        }]}
        value={clozeText}
        onChangeText={setClozeText}
        placeholder="Type your text here, then insert cloze deletions..."
        placeholderTextColor={theme.colors.textSecondary}
        multiline
      />

      {clozeText.includes('{{c') && (
        <View style={[styles.clozeInfo, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Ionicons name="information-circle" size={20} color={theme.colors.accent} />
          <Text style={[styles.clozeInfoText, { color: theme.colors.textPrimary }]}>
            This will create {(clozeText.match(/{{c\d+::/g) || []).length} card(s)
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerButton}>
          <Ionicons name="close" size={28} color={theme.colors.textPrimary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>Create Card</Text>
        <Pressable 
          onPress={handleSave}
          style={styles.headerButton}
          disabled={cardType === 'image-occlusion'}
        >
          <Text style={[styles.saveButton, { color: theme.colors.accent }]}>Save</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.content}>
        {/* Card Type Selector */}
        <View style={styles.typeSelector}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>Card Type</Text>
          
          <View style={styles.typeButtons}>
            <Pressable
              style={[
                styles.typeButton,
                { 
                  backgroundColor: cardType === 'basic' ? theme.colors.accent : theme.colors.surface,
                  borderColor: theme.colors.border,
                },
              ]}
              onPress={() => handleTypeSelect('basic')}
            >
              <Ionicons 
                name="card-outline" 
                size={24} 
                color={cardType === 'basic' ? '#000' : theme.colors.textPrimary} 
              />
              <Text style={[
                styles.typeButtonText,
                { color: cardType === 'basic' ? '#000' : theme.colors.textPrimary },
              ]}>
                Basic
              </Text>
              <Text style={[
                styles.typeButtonHint,
                { color: cardType === 'basic' ? 'rgba(0,0,0,0.7)' : theme.colors.textSecondary },
              ]}>
                Question & Answer
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.typeButton,
                { 
                  backgroundColor: cardType === 'cloze' ? theme.colors.accent : theme.colors.surface,
                  borderColor: theme.colors.border,
                },
              ]}
              onPress={() => handleTypeSelect('cloze')}
            >
              <Ionicons 
                name="ellipsis-horizontal" 
                size={24} 
                color={cardType === 'cloze' ? '#000' : theme.colors.textPrimary} 
              />
              <Text style={[
                styles.typeButtonText,
                { color: cardType === 'cloze' ? '#000' : theme.colors.textPrimary },
              ]}>
                Cloze
              </Text>
              <Text style={[
                styles.typeButtonHint,
                { color: cardType === 'cloze' ? 'rgba(0,0,0,0.7)' : theme.colors.textSecondary },
              ]}>
                Fill in the blank
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.typeButton,
                { 
                  backgroundColor: cardType === 'image-occlusion' ? theme.colors.accent : theme.colors.surface,
                  borderColor: theme.colors.border,
                },
              ]}
              onPress={() => handleTypeSelect('image-occlusion')}
            >
              <Ionicons 
                name="image-outline" 
                size={24} 
                color={cardType === 'image-occlusion' ? '#000' : theme.colors.textPrimary} 
              />
              <Text style={[
                styles.typeButtonText,
                { color: cardType === 'image-occlusion' ? '#000' : theme.colors.textPrimary },
              ]}>
                Image Occlusion
              </Text>
              <Text style={[
                styles.typeButtonHint,
                { color: cardType === 'image-occlusion' ? 'rgba(0,0,0,0.7)' : theme.colors.textSecondary },
              ]}>
                Hide parts of image
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Editor based on type */}
        {cardType === 'basic' && renderBasicEditor()}
        {cardType === 'cloze' && renderClozeEditor()}
      </ScrollView>
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
    borderBottomWidth: 1,
  },
  headerButton: {
    padding: s.xs,
    minWidth: 60,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  saveButton: {
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  typeSelector: {
    padding: s.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: s.md,
  },
  typeButtons: {
    flexDirection: 'row',
    gap: s.md,
  },
  typeButton: {
    flex: 1,
    padding: s.md,
    borderRadius: r.md,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: s.xs,
  },
  typeButtonHint: {
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
  },
  editorContainer: {
    padding: s.lg,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: s.sm,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: r.md,
    padding: s.md,
    fontSize: 16,
    textAlignVertical: 'top',
    minHeight: 100,
  },
  clozeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: s.sm,
  },
  insertButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: s.md,
    paddingVertical: s.sm,
    borderRadius: r.md,
    gap: s.xs,
  },
  insertButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  hint: {
    fontSize: 13,
    marginBottom: s.md,
    fontStyle: 'italic',
  },
  clozeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: s.md,
    borderRadius: r.md,
    borderWidth: 1,
    marginTop: s.md,
    gap: s.sm,
  },
  clozeInfoText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
