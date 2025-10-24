import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useTheme } from '../../design/theme';
import { usePremium } from '../../context/PremiumContext';
import { s } from '../../design/spacing';
import { r } from '../../design/radii';
import { AiService } from '../../services/ai/AiService';
import { NoteModel, GeneratedNote } from '../../services/ai/types';
import { ApiService } from '../../services/cloud/ApiService';
import PremiumUpsellModal from '../../components/premium/PremiumUpsellModal';
import { logger } from '../../utils/logger';

const EXAMPLE_PROMPTS = [
  "Human anatomy muscles with origin, insertion, action",
  "Spanish vocabulary for daily conversations",
  "World War 2 key events and dates",
  "Python programming concepts for beginners",
  "Organic chemistry functional groups",
];

export default function AIDeckCreatorScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const { isPremiumEffective, usage, subscribe, incrementUsage } = usePremium();
  
  const [prompt, setPrompt] = useState('');
  const [notesText, setNotesText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [showImportOptions, setShowImportOptions] = useState(false);
  const [importedFileName, setImportedFileName] = useState<string | null>(null);
  const [noteModel, setNoteModel] = useState<NoteModel>('basic');
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [itemLimit, setItemLimit] = useState('25');
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  
  // Rotate placeholder examples
  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % EXAMPLE_PROMPTS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

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
          setShowImportOptions(true);
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
            logger.info(`[Import] Read file as base64 in ${Date.now() - readStart}ms (${Math.round(base64.length / 1024)} KB)`);

            // Determine file type
            const fileType = file.name.endsWith('.docx') ? 'docx' : 'doc';

            // Send to backend for parsing
            const parseStart = Date.now();
            const response = await ApiService.post<{ text: string }>('/parse/file', {
              fileData: base64,
              fileType,
              fileName: file.name,
            });

            logger.info(`[Import] Backend parsing took ${Date.now() - parseStart}ms`);
            
            if (response.text) {
              setNotesText(response.text);
              setShowImportOptions(true);
            } else {
              throw new Error('No text extracted from Word document');
            }
          } catch (error) {
            logger.error('Word parsing error:', error);
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
            logger.info(`[Import] Read PDF as base64 in ${Date.now() - readStart}ms (${Math.round(base64.length / 1024)} KB)`);

            // Send to backend for parsing
            const parseStart = Date.now();
            const response = await ApiService.post<{ text: string }>('/parse/file', {
              fileData: base64,
              fileType: 'pdf',
              fileName: file.name,
            });

            logger.info(`[Import] Backend PDF parsing took ${Date.now() - parseStart}ms`);
            
            if (response.text) {
              setNotesText(response.text);
              setShowImportOptions(true);
            } else {
              throw new Error('No text extracted from PDF');
            }
          } catch (error) {
            logger.error('PDF parsing error:', error);
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
      logger.error('Import error:', error);
      Alert.alert('Import Error', 'Failed to import file. Please try again.');
      setImportedFileName(null);
    }
  };

  const handleGenerate = async () => {
    // Determine source type based on what user filled in
    const sourceType = notesText.trim() ? 'notes' : 'prompt';
    
    // Validation
    if (!prompt.trim() && !notesText.trim()) {
      Alert.alert('Missing Input', 'Please enter either a prompt or paste your notes.');
      return;
    }

    const limit = parseInt(itemLimit) || 50;

    // TODO: MAJOR - RE-ENABLE QUOTA CHECK BEFORE PRODUCTION
    // Temporarily disabled for testing
    // if (!isPremiumEffective && usage) {
    //   if (usage.deckGenerations >= usage.limits.decks) {
    //     setShowPremiumModal(true);
    //     return;
    //   }
    // }

    // Navigate to loading screen with handler
    navigation.navigate('AIGenerating' as any);

    try {
      const response = await AiService.generateDeck({
        sourceType,
        prompt: prompt.trim() ? prompt : undefined,
        notesText: notesText.trim() ? notesText : undefined,
        deckName: undefined,
        noteModel,
        itemLimit: limit,
      });

      // Increment usage after successful generation
      await incrementUsage('deck');

      // Replace loading screen with preview (can't go back to loading)
      navigation.replace('AIDeckPreview', {
        deckName: response.deckName,
        noteModel: response.model,
        notes: response.notes,
        metadata: response.metadata,
      });
    } catch (error) {
      logger.error('AI generation error:', error);
      // Go back to creator screen
      navigation.goBack();
      
      // Check if quota exceeded
      const errorMessage = error instanceof Error ? error.message : '';
      if (errorMessage.includes('limit reached') || errorMessage.includes('quota')) {
        setShowPremiumModal(true);
      } else {
        Alert.alert(
          'Generation Failed',
          errorMessage || 'Failed to generate deck. Please try again.'
        );
      }
    }
  };

  const handleSubscribePress = async () => {
    try {
      await subscribe();
      setShowPremiumModal(false);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to start subscription');
    }
  };

  const handleCountPress = (count: string) => {
    const countNum = parseInt(count);
    // TODO: MAJOR - RE-ENABLE PREMIUM CHECK BEFORE PRODUCTION
    // Temporarily disabled for testing
    // if (!isPremiumEffective && countNum > 25) {
    //   setShowPremiumModal(true);
    //   return;
    // }
    setItemLimit(count);
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
            <LinearGradient
              colors={['#8B5CF6', '#EC4899']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.headerIconGradient}
            >
              <Ionicons name="sparkles" size={20} color="#FFF" />
            </LinearGradient>
            <View>
              <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Create with AI</Text>
              <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>Generate ~{itemLimit} cards instantly</Text>
            </View>
          </View>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView 
          style={styles.scrollView} 
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Main Input - Smart unified input */}
          <View style={styles.mainInputSection}>
            <View style={styles.inputHeader}>
              <Text style={[styles.inputLabel, { color: theme.colors.textPrimary }]}>
                What do you want to learn?
              </Text>
              <Text style={[styles.inputHint, { color: theme.colors.textSecondary }]}>
                Describe the topic, add your notes, or both
              </Text>
            </View>
            
            <TextInput
              style={[
                styles.mainInput,
                { backgroundColor: theme.colors.surface2, color: theme.colors.textHigh, borderWidth: 1, borderColor: theme.colors.border },
              ]}
              placeholder={EXAMPLE_PROMPTS[placeholderIndex]}
              placeholderTextColor={theme.colors.textMed}
              value={prompt || notesText}
              onChangeText={(text) => {
                if (notesText) {
                  setNotesText(text);
                } else {
                  setPrompt(text);
                }
              }}
              multiline
              numberOfLines={8}
              textAlignVertical="top"
            />
            
            {/* Import file button */}
            {!notesText && (
              <View style={styles.orDivider}>
                <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />
                <Text style={[styles.orText, { color: theme.colors.textSecondary }]}>or</Text>
                <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />
              </View>
            )}
            
            {!notesText && (
              <Pressable
                style={[styles.importFileButton, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface2 }]}
                onPress={handleImportFile}
                disabled={isParsing}
              >
                <View style={[styles.importIconCircle, { backgroundColor: theme.colors.overlay.primary }]}>
                  {isParsing ? (
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                  ) : (
                    <Ionicons name="cloud-upload" size={20} color={theme.colors.primary} />
                  )}
                </View>
                <View style={styles.importFileContent}>
                  <Text style={[styles.importFileText, { color: theme.colors.textHigh }]}>
                    {isParsing ? 'Parsing file...' : 'Choose File'}
                  </Text>
                  <Text style={[styles.importFileHint, { color: theme.colors.textMed }]}>
                    {isParsing ? 'Please wait...' : '.txt, .pdf, .doc, .docx'}
                  </Text>
                </View>
              </Pressable>
            )}
            
            {/* Notes preview (when imported) */}
            {notesText && importedFileName && (
              <View style={[styles.fileTag, { backgroundColor: theme.colors.overlay.primary }]}>
                <Ionicons name="document-text" size={14} color={theme.colors.primary} />
                <Text style={[styles.fileTagText, { color: theme.colors.textMed }]}>
                  {importedFileName}
                </Text>
                <Pressable onPress={() => { setNotesText(''); setImportedFileName(null); setPrompt(''); }}>
                  <Ionicons name="close-circle" size={16} color={theme.colors.textMed} />
                </Pressable>
              </View>
            )}
          </View>

          {/* Card Count Selector */}
          <View style={styles.cardCountSection}>
            <Text style={[styles.cardTypeLabel, { color: theme.colors.textSecondary }]}>
              NUMBER OF CARDS
            </Text>
            <View style={styles.countOptions}>
              {['25', '50', '75', '100'].map((count) => {
                // TODO: MAJOR - RE-ENABLE LOCK BADGE BEFORE PRODUCTION
                // Temporarily disabled for testing
                // const countNum = parseInt(count);
                // const isLocked = !isPremiumEffective && countNum > 25;
                const isLocked = false;
                return (
                  <Pressable
                    key={count}
                    style={[
                      styles.countOption,
                      itemLimit === count
                        ? {
                            backgroundColor: theme.colors.overlay.primary,
                            borderColor: theme.colors.primary,
                          }
                        : {
                            backgroundColor: theme.colors.surface2,
                            borderColor: theme.colors.border,
                          },
                      isLocked && { opacity: 0.5 },
                    ]}
                    onPress={() => handleCountPress(count)}
                  >
                    {isLocked && (
                      <View style={[styles.proBadge, { backgroundColor: theme.colors.warning }]}>
                        <Text style={styles.proBadgeText}>PRO</Text>
                      </View>
                    )}
                    <Text style={[
                      styles.countText,
                      itemLimit === count
                        ? { color: theme.colors.primary }
                        : { color: theme.colors.textHigh },
                    ]}>
                      {count}
                    </Text>
                  </Pressable>
                );
              })}
              <Pressable
                style={[
                  styles.countOption,
                  styles.customCountOption,
                  { 
                    backgroundColor: !['25', '50', '75', '100'].includes(itemLimit) ? theme.colors.overlay.primary : theme.colors.surface2,
                    borderColor: !['25', '50', '75', '100'].includes(itemLimit) ? theme.colors.primary : theme.colors.border,
                    // TODO: MAJOR - RE-ENABLE OPACITY LOCK BEFORE PRODUCTION
                    // opacity: !isPremiumEffective ? 0.5 : 1,
                  },
                ]}
                onPress={() => {
                  // TODO: MAJOR - RE-ENABLE PREMIUM CHECK BEFORE PRODUCTION
                  // Temporarily disabled for testing
                  // if (!isPremiumEffective) {
                  //   setShowPremiumModal(true);
                  //   return;
                  // }
                  Alert.prompt(
                    'Custom Amount',
                    'Enter number of cards (max 150)',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Set',
                        onPress: (value?: string) => {
                          const num = parseInt(value || '50');
                          if (num >= 1 && num <= 150) {
                            setItemLimit(value || '50');
                          } else {
                            Alert.alert('Invalid', 'Please enter a number between 1 and 150');
                          }
                        },
                      },
                    ],
                    'plain-text',
                    itemLimit,
                    'number-pad'
                  );
                }}
              >
                {/* TODO: MAJOR - RE-ENABLE PRO BADGE BEFORE PRODUCTION */}
                {/* {!isPremiumEffective && (
                  <View style={[styles.proBadge, { backgroundColor: theme.colors.warning }]}>
                    <Text style={styles.proBadgeText}>PRO</Text>
                  </View>
                )} */}
                <Text style={[
                  styles.countText,
                  { color: !['25', '50', '75', '100'].includes(itemLimit) ? theme.colors.primary : theme.colors.textHigh }
                ]}>
                  {!['25', '50', '75', '100'].includes(itemLimit) ? itemLimit : 'Custom'}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Card Type - Simplified Pills */}
          <View style={styles.cardTypeSection}>
            <Text style={[styles.cardTypeLabel, { color: theme.colors.textSecondary }]}>
              CARD TYPE
            </Text>
            <View style={styles.pillGroup}>
              <Pressable
                style={[
                  styles.pill,
                  { 
                    borderColor: noteModel === 'basic' ? theme.colors.primary : theme.colors.border,
                    backgroundColor: noteModel === 'basic' ? theme.colors.overlay.primary : theme.colors.surface2,
                  },
                ]}
                onPress={() => setNoteModel('basic')}
              >
                <View style={styles.pillContent}>
                  <Ionicons 
                    name="swap-horizontal" 
                    size={20} 
                    color={noteModel === 'basic' ? theme.colors.primary : theme.colors.textHigh} 
                  />
                  <Text style={[
                    styles.pillText,
                    { color: noteModel === 'basic' ? theme.colors.primary : theme.colors.textHigh }
                  ]}>
                    Front & Back
                  </Text>
                </View>
              </Pressable>
              
              <Pressable
                style={[
                  styles.pill,
                  { 
                    borderColor: noteModel === 'cloze' ? theme.colors.primary : theme.colors.border,
                    backgroundColor: noteModel === 'cloze' ? theme.colors.overlay.primary : theme.colors.surface2,
                  },
                ]}
                onPress={() => setNoteModel('cloze')}
              >
                <View style={styles.pillContent}>
                  <Ionicons 
                    name="remove-circle-outline" 
                    size={20} 
                    color={noteModel === 'cloze' ? theme.colors.primary : theme.colors.textHigh} 
                  />
                  <Text style={[
                    styles.pillText,
                    { color: noteModel === 'cloze' ? theme.colors.primary : theme.colors.textHigh }
                  ]}>
                    Fill-in-Blank
                  </Text>
                </View>
              </Pressable>
            </View>
          </View>

        </ScrollView>

        {/* Generate Button with Magic */}
        <View style={[styles.footer, { backgroundColor: theme.colors.bg, borderTopColor: theme.colors.border }]}>
          {!isPremiumEffective && usage && (
            <View style={[styles.usageBar, { backgroundColor: theme.colors.surface2 }]}>
              <Ionicons name="information-circle-outline" size={16} color={theme.colors.textMed} />
              <Text style={[styles.usageText, { color: theme.colors.textMed }]}>
                {usage.deckGenerations}/{usage.limits.deck} free generations used this month
              </Text>
            </View>
          )}
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
      <PremiumUpsellModal
        visible={showPremiumModal}
        onClose={() => setShowPremiumModal(false)}
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: s.lg,
    paddingVertical: s.md,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.sm,
  },
  headerIconGradient: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
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
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: s.lg,
    paddingTop: s.md,
    gap: s.lg,
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
    gap: s.md,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
  input: {
    borderRadius: r.lg,
    padding: s.lg,
    fontSize: 16,
  },
  promptInput: {
    minHeight: 140,
    fontSize: 17,
  },
  notesInput: {
    minHeight: 240,
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
  textInputSection: {
    marginTop: s.sm,
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
  usageBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.xs,
    padding: s.sm,
    borderRadius: r.md,
    marginBottom: s.md,
  },
  usageText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
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
  // New unified input styles
  mainInputSection: {
    gap: s.md,
  },
  inputHeader: {
    gap: s.xs / 2,
  },
  inputLabel: {
    fontSize: 18,
    fontWeight: '700',
  },
  inputHint: {
    fontSize: 14,
    lineHeight: 20,
  },
  mainInput: {
    borderRadius: r.lg,
    padding: s.xl,
    fontSize: 17,
    minHeight: 180,
    lineHeight: 24,
  },
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.md,
    marginVertical: s.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  orText: {
    fontSize: 13,
    fontWeight: '600',
  },
  importFileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: s.lg,
    borderRadius: r.lg,
    borderWidth: 2,
    gap: s.md,
  },
  importIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  importFileContent: {
    flex: 1,
    gap: s.xs / 2,
  },
  importFileText: {
    fontSize: 16,
    fontWeight: '700',
  },
  importFileHint: {
    fontSize: 13,
  },
  fileTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.xs,
    paddingHorizontal: s.md,
    paddingVertical: s.sm,
    borderRadius: r.pill,
    alignSelf: 'flex-start',
  },
  fileTagText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  // Card count selection
  cardCountSection: {
    gap: s.sm,
  },
  countOptions: {
    flexDirection: 'row',
    gap: s.sm,
  },
  countOption: {
    flex: 1,
    paddingVertical: s.md,
    paddingHorizontal: s.sm,
    borderRadius: r.lg,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  countText: {
    fontSize: 16,
    fontWeight: '700',
  },
  proBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: r.sm,
  },
  proBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#fff',
  },
  customCountOption: {
    minWidth: 70,
  },
  // Simplified card type selection
  cardTypeSection: {
    gap: s.sm,
  },
  cardTypeLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pillGroup: {
    flexDirection: 'row',
    gap: s.sm,
  },
  pill: {
    flex: 1,
    borderRadius: r.lg,
    borderWidth: 2,
    overflow: 'hidden',
    position: 'relative',
  },
  pillGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  pillContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: s.lg,
    gap: s.sm,
  },
  pillSelected: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  pillText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
