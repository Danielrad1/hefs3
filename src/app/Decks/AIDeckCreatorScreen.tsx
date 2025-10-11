import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useTheme } from '../../design/theme';
import { s } from '../../design/spacing';
import { r } from '../../design/radii';
import { AiService } from '../../services/ai/AiService';
import { NoteModel, GeneratedNote } from '../../services/ai/types';
import { ApiService } from '../../services/cloud/ApiService';

type TabType = 'prompt' | 'notes';

export default function AIDeckCreatorScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  
  const [activeTab, setActiveTab] = useState<TabType>('prompt');
  const [prompt, setPrompt] = useState('');
  const [notesText, setNotesText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [showPasteInput, setShowPasteInput] = useState(false);
  const [importedFileName, setImportedFileName] = useState<string | null>(null);
  const [deckName, setDeckName] = useState('');
  const [noteModel, setNoteModel] = useState<NoteModel>('basic');
  const [itemLimit, setItemLimit] = useState('50');

  const handleImportFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'text/plain',
          'application/pdf',
          'application/msword', // .doc
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const file = result.assets[0];
      setImportedFileName(file.name);

      // Read file content
      if (file.uri) {
        if (file.mimeType === 'text/plain' || file.name.endsWith('.txt')) {
          // Handle .txt files directly
          const content = await FileSystem.readAsStringAsync(file.uri);
          setNotesText(content);
          setShowPasteInput(false);
        } else if (
          file.name.endsWith('.docx') || 
          file.name.endsWith('.doc') ||
          file.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
          file.mimeType === 'application/msword'
        ) {
          // Handle Word documents - send to backend for parsing
          setIsParsing(true);
          
          try {
            const readStart = Date.now();
            const base64 = await FileSystem.readAsStringAsync(file.uri, {
              encoding: FileSystem.EncodingType.Base64,
            });
            console.log(`[Import] Read file as base64 in ${Date.now() - readStart}ms (${Math.round(base64.length / 1024)} KB)`);

            // Determine file type
            const fileType = file.name.endsWith('.docx') ? 'docx' : 'doc';

            // Send to backend for parsing
            const parseStart = Date.now();
            const response = await ApiService.post<{ text: string }>('/parse/file', {
              fileData: base64,
              fileType,
              fileName: file.name,
            });

            console.log(`[Import] Backend parsing took ${Date.now() - parseStart}ms`);
            
            if (response.text) {
              setNotesText(response.text);
              setShowPasteInput(false);
            } else {
              throw new Error('No text extracted from Word document');
            }
          } catch (error) {
            console.error('Word parsing error:', error);
            Alert.alert(
              'Parsing Error',
              error instanceof Error ? error.message : 'Failed to extract text from Word document. Please try again or use a different file.',
              [{ text: 'OK' }]
            );
            setImportedFileName(null);
          } finally {
            setIsParsing(false);
          }
        } else if (file.name.endsWith('.pdf') || file.mimeType === 'application/pdf') {
          // Handle PDF files - send to backend for parsing
          setIsParsing(true);
          
          try {
            const readStart = Date.now();
            const base64 = await FileSystem.readAsStringAsync(file.uri, {
              encoding: FileSystem.EncodingType.Base64,
            });
            console.log(`[Import] Read PDF as base64 in ${Date.now() - readStart}ms (${Math.round(base64.length / 1024)} KB)`);

            // Send to backend for parsing
            const parseStart = Date.now();
            const response = await ApiService.post<{ text: string }>('/parse/file', {
              fileData: base64,
              fileType: 'pdf',
              fileName: file.name,
            });

            console.log(`[Import] Backend PDF parsing took ${Date.now() - parseStart}ms`);
            
            if (response.text) {
              setNotesText(response.text);
              setShowPasteInput(false);
            } else {
              throw new Error('No text extracted from PDF');
            }
          } catch (error) {
            console.error('PDF parsing error:', error);
            Alert.alert(
              'Parsing Error',
              error instanceof Error ? error.message : 'Failed to extract text from PDF. Please try again or use a different file.',
              [{ text: 'OK' }]
            );
            setImportedFileName(null);
          } finally {
            setIsParsing(false);
          }
        } else {
          Alert.alert(
            'File Type Not Supported',
            'Supported formats: .txt, .doc, .docx, .pdf'
          );
          setImportedFileName(null);
        }
      }
    } catch (error) {
      console.error('Import error:', error);
      Alert.alert('Import Error', 'Failed to import file. Please try again.');
      setImportedFileName(null);
    }
  };

  const handleGenerate = async () => {
    // Validation
    if (activeTab === 'prompt' && !prompt.trim()) {
      Alert.alert('Error', 'Please enter a prompt');
      return;
    }
    if (activeTab === 'notes' && !notesText.trim()) {
      Alert.alert('Error', 'Please paste some notes');
      return;
    }

    const limit = parseInt(itemLimit) || 50;
    if (limit < 1 || limit > 1000) {
      Alert.alert('Error', 'Item limit must be between 1 and 1000');
      return;
    }

    // Navigate to loading screen immediately
    navigation.navigate('AIGenerating' as any);

    try {
      const response = await AiService.generateDeck({
        sourceType: activeTab,
        prompt: activeTab === 'prompt' ? prompt : undefined,
        notesText: activeTab === 'notes' ? notesText : undefined,
        deckName: deckName || undefined,
        noteModel,
        itemLimit: limit,
      });

      // Navigate to preview screen
      navigation.navigate('AIDeckPreview', {
        deckName: response.deckName,
        noteModel: response.model,
        notes: response.notes,
        metadata: response.metadata,
      });
    } catch (error) {
      console.error('AI generation error:', error);
      // Go back from loading screen
      navigation.goBack();
      Alert.alert(
        'Generation Failed',
        error instanceof Error ? error.message : 'Failed to generate deck. Please try again.'
      );
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]} edges={['top']}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
        keyboardVerticalOffset={0}
      >
        {/* Simple Header */}
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
          </Pressable>
          <View style={styles.headerContent}>
            <Ionicons name="sparkles" size={24} color="#8B5CF6" style={styles.sparkleIcon} />
            <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Create with AI</Text>
          </View>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView 
          style={styles.scrollView} 
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
        {/* Tabs */}
        <View style={[styles.tabContainer, { backgroundColor: theme.colors.surface }]}>
          <Pressable
            style={styles.tab}
            onPress={() => setActiveTab('prompt')}
          >
            {activeTab === 'prompt' ? (
              <LinearGradient
                colors={['#8B5CF6', '#EC4899']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.tabGradient}
              >
                <Text style={[styles.tabText, { color: '#FFF' }]}>
                  Prompt
                </Text>
              </LinearGradient>
            ) : (
              <View style={styles.tabInactive}>
                <Text style={[styles.tabText, { color: theme.colors.textSecondary }]}>
                  Prompt
                </Text>
              </View>
            )}
          </Pressable>
          <Pressable
            style={styles.tab}
            onPress={() => setActiveTab('notes')}
          >
            {activeTab === 'notes' ? (
              <LinearGradient
                colors={['#8B5CF6', '#EC4899']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.tabGradient}
              >
                <Text style={[styles.tabText, { color: '#FFF' }]}>
                  Import Notes
                </Text>
              </LinearGradient>
            ) : (
              <View style={styles.tabInactive}>
                <Text style={[styles.tabText, { color: theme.colors.textSecondary }]}>
                  Import Notes
                </Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* Input Section */}
        {activeTab === 'prompt' ? (
          <View style={styles.section}>
            <Text style={[styles.label, { color: theme.colors.textPrimary }]}>
              What do you want to learn?
            </Text>
            <Text style={[styles.hint, { color: theme.colors.textSecondary, marginBottom: s.xs }]}>
              Enter as little or as much detail as you'd like. Describe the topic, difficulty level, or how you want your deck structured for best results.
            </Text>
            <TextInput
              style={[
                styles.input,
                styles.promptInput,
                { backgroundColor: theme.colors.surface, color: theme.colors.textPrimary },
              ]}
              placeholder="e.g., human anatomy cards covering muscles with origin, insertion, action, and innervation"
              placeholderTextColor={theme.colors.textSecondary}
              value={prompt}
              onChangeText={setPrompt}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={[styles.label, { color: theme.colors.textPrimary }]}>
              Import your notes
            </Text>
            
            {/* Import and Paste Options */}
            <View style={styles.importOptionsContainer}>
              {/* Import Button */}
              <Pressable
                style={[styles.importButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                onPress={handleImportFile}
                disabled={isParsing}
              >
                {isParsing ? (
                  <ActivityIndicator size="small" color="#8B5CF6" />
                ) : (
                  <Ionicons name="document-attach" size={24} color="#8B5CF6" />
                )}
                <View style={styles.importButtonContent}>
                  <Text style={[styles.importButtonText, { color: theme.colors.textPrimary }]}>
                    {isParsing ? 'Parsing file...' : importedFileName || 'Import File'}
                  </Text>
                  <Text style={[styles.importButtonHint, { color: theme.colors.textSecondary }]}>
                    {isParsing ? 'Please wait' : importedFileName ? 'Tap to change' : '.txt, .doc, .docx, .pdf'}
                  </Text>
                </View>
                {!isParsing && <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />}
              </Pressable>

              {/* Paste Button */}
              <Pressable
                style={[styles.importButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                onPress={() => setShowPasteInput(!showPasteInput)}
              >
                <Ionicons name="clipboard-outline" size={24} color="#8B5CF6" />
                <View style={styles.importButtonContent}>
                  <Text style={[styles.importButtonText, { color: theme.colors.textPrimary }]}>
                    Paste Text
                  </Text>
                  <Text style={[styles.importButtonHint, { color: theme.colors.textSecondary }]}>
                    Copy and paste directly
                  </Text>
                </View>
                <Ionicons 
                  name={showPasteInput ? "chevron-up" : "chevron-down"} 
                  size={20} 
                  color={theme.colors.textSecondary} 
                />
              </Pressable>
            </View>

            {/* Paste Text Area */}
            {showPasteInput && (
              <View style={styles.pasteSection}>
                <TextInput
                  style={[
                    styles.input,
                    styles.notesInput,
                    { backgroundColor: theme.colors.surface, color: theme.colors.textPrimary },
                  ]}
                  placeholder="Paste your notes here..."
                  placeholderTextColor={theme.colors.textSecondary}
                  value={notesText}
                  onChangeText={setNotesText}
                  multiline
                  numberOfLines={10}
                  textAlignVertical="top"
                />
              </View>
            )}

            {/* Text Preview/Edit (for imported files) */}
            {notesText && !showPasteInput && (
              <View style={styles.previewSection}>
                <Text style={[styles.previewLabel, { color: theme.colors.textSecondary }]}>
                  Preview (editable):
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    styles.notesInput,
                    { backgroundColor: theme.colors.surface, color: theme.colors.textPrimary },
                  ]}
                  placeholder="Your imported notes will appear here..."
                  placeholderTextColor={theme.colors.textSecondary}
                  value={notesText}
                  onChangeText={setNotesText}
                  multiline
                  numberOfLines={8}
                  textAlignVertical="top"
                />
              </View>
            )}
          </View>
        )}

        {/* Options */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.colors.textPrimary }]}>
            Deck Name (optional)
          </Text>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: theme.colors.surface, color: theme.colors.textPrimary },
            ]}
            placeholder="AI will suggest a name if left empty"
            placeholderTextColor={theme.colors.textSecondary}
            value={deckName}
            onChangeText={setDeckName}
          />
        </View>

        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.colors.textPrimary }]}>
            Card Type
          </Text>
          <View style={styles.radioGroup}>
            <Pressable
              style={styles.radioOption}
              onPress={() => setNoteModel('basic')}
            >
              <View style={[
                styles.radioCard,
                { backgroundColor: theme.colors.surface },
                noteModel === 'basic' && styles.radioCardSelected,
              ]}>
                {noteModel === 'basic' && (
                  <LinearGradient
                    colors={['#8B5CF6', '#EC4899']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.selectedBorder}
                  />
                )}
                <View style={styles.radioContent}>
                  <Ionicons
                    name={noteModel === 'basic' ? 'radio-button-on' : 'radio-button-off'}
                    size={24}
                    color={noteModel === 'basic' ? '#8B5CF6' : theme.colors.textSecondary}
                  />
                  <View style={styles.radioTextContainer}>
                    <Text style={[styles.radioTitle, { color: theme.colors.textPrimary }]}>
                      Basic (Q&A)
                    </Text>
                    <Text style={[styles.radioDesc, { color: theme.colors.textSecondary }]}>
                      Front and back cards
                    </Text>
                  </View>
                </View>
              </View>
            </Pressable>

            <Pressable
              style={styles.radioOption}
              onPress={() => setNoteModel('cloze')}
            >
              <View style={[
                styles.radioCard,
                { backgroundColor: theme.colors.surface },
                noteModel === 'cloze' && styles.radioCardSelected,
              ]}>
                {noteModel === 'cloze' && (
                  <LinearGradient
                    colors={['#8B5CF6', '#EC4899']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.selectedBorder}
                  />
                )}
                <View style={styles.radioContent}>
                  <Ionicons
                    name={noteModel === 'cloze' ? 'radio-button-on' : 'radio-button-off'}
                    size={24}
                    color={noteModel === 'cloze' ? '#8B5CF6' : theme.colors.textSecondary}
                  />
                  <View style={styles.radioTextContainer}>
                    <Text style={[styles.radioTitle, { color: theme.colors.textPrimary }]}>
                      Fill in the Blank
                    </Text>
                    <Text style={[styles.radioDesc, { color: theme.colors.textSecondary }]}>
                      Test recall by hiding key terms
                    </Text>
                  </View>
                </View>
              </View>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.colors.textPrimary }]}>
            Number of Cards
          </Text>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: theme.colors.surface, color: theme.colors.textPrimary },
            ]}
            placeholder="50"
            placeholderTextColor={theme.colors.textSecondary}
            value={itemLimit}
            onChangeText={setItemLimit}
            keyboardType="number-pad"
          />
          <Text style={[styles.hint, { color: theme.colors.textSecondary }]}>
            Maximum: 1000 cards
          </Text>
        </View>
        </ScrollView>

        {/* Generate Button with Magic */}
        <View style={[styles.footer, { backgroundColor: theme.colors.bg, borderTopColor: theme.colors.border }]}>
          <Pressable
            style={styles.generateButton}
            onPress={handleGenerate}
          >
            <LinearGradient
              colors={['#8B5CF6', '#EC4899']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gradientButton}
            >
              <View style={styles.buttonContent}>
                <Ionicons name="sparkles" size={20} color="#FFF" />
                <Text style={styles.generateButtonTextWhite}>Generate Deck</Text>
              </View>
            </LinearGradient>
          </Pressable>
        </View>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: s.lg,
    paddingVertical: s.md,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.xs,
  },
  sparkleIcon: {
    marginRight: s.xs / 2,
  },
  backButton: {
    padding: s.xs,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: s.lg,
    gap: s.xl,
  },
  tabContainer: {
    flexDirection: 'row',
    borderRadius: r.lg,
    padding: s.xs,
    gap: s.xs,
  },
  tab: {
    flex: 1,
    borderRadius: r.md,
    overflow: 'hidden',
  },
  tabGradient: {
    paddingVertical: s.sm,
    borderRadius: r.md,
    alignItems: 'center',
  },
  tabInactive: {
    paddingVertical: s.sm,
    borderRadius: r.md,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    gap: s.sm,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
  input: {
    borderRadius: r.md,
    padding: s.md,
    fontSize: 16,
  },
  promptInput: {
    minHeight: 100,
  },
  notesInput: {
    minHeight: 200,
  },
  hint: {
    fontSize: 14,
  },
  importOptionsContainer: {
    gap: s.sm,
  },
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: s.md,
    borderRadius: r.md,
    borderWidth: 1,
    gap: s.md,
  },
  importButtonContent: {
    flex: 1,
    gap: s.xs / 2,
  },
  importButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  importButtonHint: {
    fontSize: 14,
  },
  pasteSection: {
    marginTop: s.sm,
  },
  previewSection: {
    gap: s.xs,
    marginTop: s.sm,
  },
  previewLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  radioGroup: {
    gap: s.md,
  },
  radioOption: {
    borderRadius: r.md,
  },
  radioCard: {
    borderRadius: r.md,
    padding: s.md,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
    overflow: 'hidden',
  },
  radioCardSelected: {
    borderColor: 'transparent',
  },
  selectedBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  radioContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.md,
  },
  radioTextContainer: {
    flex: 1,
    gap: s.xs / 2,
  },
  radioTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  radioDesc: {
    fontSize: 14,
  },
  footer: {
    padding: s.lg,
    borderTopWidth: 1,
  },
  generateButton: {
    borderRadius: r.md,
    overflow: 'hidden',
  },
  gradientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: s.md,
    borderRadius: r.md,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.sm,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.md,
  },
  generateButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
  },
  generateButtonTextWhite: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFF',
  },
});
