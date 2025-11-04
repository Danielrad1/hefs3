import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
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
import { ApiService } from '../../services/cloud/ApiService';
import { NetworkService } from '../../services/network/NetworkService';
import { logger } from '../../utils/logger';
import {
  FileAttachment,
  InstructionOptions,
  composeNotesTextFromAttachments,
  getTotalCharacterCount,
  getDefaultInstructions,
} from '../../services/ai/promptBuilders';
import ChoiceStep from './components/ChoiceStep';
import FilesStep from './components/FilesStep';
import InstructionsStep from './components/InstructionsStep';
import SettingsStep from './components/SettingsStep';

const TOPIC_PROMPTS = [
  'Human anatomy muscles with origin, insertion, action',
  'Spanish vocabulary for daily conversations',
  'World War 2 key events and dates',
  'Python programming concepts for beginners',
  'Organic chemistry functional groups',
];

const FILE_PROMPTS = [
  'Focus on key concepts and definitions',
  'Include examples for each major point',
  'Emphasize practical applications',
  'Create cards for formulas and equations',
  'Break down complex processes step-by-step',
];

type Step = 'choice' | 'files' | 'instructions' | 'settings';
type ModelTier = 'basic' | 'advanced';

// Free version: always use basic model for deck generation
const DEFAULT_MODEL_TIER: ModelTier = 'basic';

const CHARACTER_WARNING_THRESHOLD = 300000;

export default function AIDeckCreatorScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const { isPremiumEffective } = usePremium();

  const [currentStep, setCurrentStep] = useState<Step>('choice');
  const [useFiles, setUseFiles] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [instructions, setInstructions] = useState<InstructionOptions>(getDefaultInstructions());
  const [itemLimit, setItemLimit] = useState('25');

  useEffect(() => {
    const prompts = useFiles ? FILE_PROMPTS : TOPIC_PROMPTS;
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % prompts.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [useFiles]);

  const handleChoiceWithFiles = () => {
    setUseFiles(true);
    setCurrentStep('files');
  };

  const handleChoiceWithoutFiles = () => {
    setUseFiles(false);
    setCurrentStep('instructions');
  };

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

  const handleNext = async () => {
    if (currentStep === 'files') {
      if (attachments.length === 0) {
        Alert.alert('No Files', 'Please add at least one file or go back to skip files.');
        return;
      }

      const unfinishedFiles = attachments.filter((att) => !att.parsedText);
      if (unfinishedFiles.length > 0) {
        Alert.alert('Files Processing', 'Please wait for files to finish parsing.');
        return;
      }

      setCurrentStep('settings');
    } else if (currentStep === 'settings') {
      if (useFiles) {
        setCurrentStep('instructions');
      } else {
        // Free version: skip model selection, go directly to generate
        handleGenerate();
      }
    } else if (currentStep === 'instructions') {
      if (!useFiles && prompt.trim().length === 0) {
        Alert.alert('Missing Input', 'Please describe what you want to learn.');
        return;
      }

      if (useFiles) {
        // Free version: skip model selection, go directly to generate
        handleGenerate();
      } else {
        setCurrentStep('settings');
      }
    }
  };

  const handleBack = () => {
    if (currentStep === 'files') {
      setCurrentStep('choice');
      setAttachments([]);
    } else if (currentStep === 'settings') {
      if (useFiles) {
        setCurrentStep('files');
      } else {
        setCurrentStep('instructions');
      }
    } else if (currentStep === 'instructions') {
      if (useFiles) {
        setCurrentStep('settings');
      } else {
        setCurrentStep('choice');
      }
    }
  };

  const handleGenerate = async () => {
    const hasPrompt = prompt.trim().length > 0;
    const hasFiles = attachments.length > 0;

    if (!hasPrompt && !hasFiles) {
      Alert.alert('Missing Input', 'Please provide input to generate cards.');
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

    navigation.navigate('AIGenerating' as any, {
      prompt: finalPrompt,
      notesText: finalNotesText,
      noteModel: instructions.cardFormat,
      itemLimit: limit,
      modelTier: DEFAULT_MODEL_TIER,
    });
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 'choice':
        return 'Create with AI';
      case 'files':
        return 'Import Files';
      case 'instructions':
        return 'Instructions';
      case 'settings':
        return 'Settings';
      default:
        return 'Create with AI';
    }
  };

  const getStepSubtitle = () => {
    switch (currentStep) {
      case 'choice':
        return 'Get started';
      case 'files':
        return `Step 1 of 3`;
      case 'instructions':
        return useFiles ? 'Step 3 of 3' : 'Step 1 of 2';
      case 'settings':
        return useFiles ? 'Step 2 of 3' : 'Step 2 of 2';
      default:
        return '';
    }
  };

  const canProceed = () => {
    if (currentStep === 'files') {
      return attachments.length > 0 && !isParsingFile;
    }
    if (currentStep === 'instructions') {
      return useFiles || prompt.trim().length > 0;
    }
    return true;
  };

  const totalChars = getTotalCharacterCount(attachments);
  const showCharacterWarning = totalChars > CHARACTER_WARNING_THRESHOLD;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => {
              if (currentStep === 'choice') {
                navigation.goBack();
              } else {
                handleBack();
              }
            }}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
          </Pressable>
          <View style={styles.headerContent}>
            <View
              style={[styles.headerIconGradient, { backgroundColor: theme.colors.overlay.primary }]}
            >
              <Ionicons name="sparkles" size={20} color={theme.colors.primary} />
            </View>
            <View>
              <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
                {getStepTitle()}
              </Text>
              <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
                {getStepSubtitle()}
              </Text>
            </View>
          </View>
          <View style={{ width: 24 }} />
        </View>

        {/* Step Content */}
        <View style={styles.content}>
          {currentStep === 'choice' && (
            <ChoiceStep
              onChooseWithFiles={handleChoiceWithFiles}
              onChooseWithoutFiles={handleChoiceWithoutFiles}
            />
          )}

          {currentStep === 'files' && (
            <FilesStep
              attachments={attachments}
              isParsingFile={isParsingFile}
              onAddFile={handleAddFile}
              onRemoveFile={handleRemoveFile}
              onMoveFile={handleMoveFile}
              showCharacterWarning={showCharacterWarning}
              totalChars={totalChars}
            />
          )}

          {currentStep === 'instructions' && (
            <InstructionsStep
              prompt={prompt}
              onPromptChange={setPrompt}
              placeholder={(useFiles ? FILE_PROMPTS : TOPIC_PROMPTS)[placeholderIndex]}
              hasFiles={useFiles}
            />
          )}

          {currentStep === 'settings' && (
            <SettingsStep
              instructions={instructions}
              onInstructionsChange={setInstructions}
              itemLimit={itemLimit}
              onCountChange={setItemLimit}
              isPremiumEffective={isPremiumEffective}
              onShowPremiumModal={() => {}}
              hasFiles={useFiles}
            />
          )}
        </View>

        {/* Footer */}
        {currentStep !== 'choice' && (
          <View
            style={[
              styles.footer,
              { backgroundColor: theme.colors.bg, borderTopColor: theme.colors.border },
            ]}
          >
            <Pressable
              style={[
                styles.button,
                {
                  backgroundColor: canProceed() ? theme.colors.primary : theme.colors.surface2,
                },
              ]}
              onPress={handleNext}
              disabled={!canProceed()}
            >
              <Text
                style={[
                  styles.buttonText,
                  { color: canProceed() ? '#fff' : theme.colors.textLow },
                ]}
              >
                {currentStep === 'settings' && !useFiles ? 'Generate Deck' : currentStep === 'instructions' && useFiles ? 'Generate Deck' : 'Next'}
              </Text>
              <Ionicons
                name={currentStep === 'settings' && !useFiles ? 'sparkles' : currentStep === 'instructions' && useFiles ? 'sparkles' : 'arrow-forward'}
                size={20}
                color={canProceed() ? '#fff' : theme.colors.textLow}
              />
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: s.lg,
    paddingVertical: s.md,
  },
  backButton: { padding: s.xs },
  headerContent: { flexDirection: 'row', alignItems: 'center', gap: s.sm },
  headerIconGradient: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 20, fontWeight: '700' },
  subtitle: { fontSize: 13, marginTop: 2 },
  content: { flex: 1 },
  footer: {
    padding: s.lg,
    borderTopWidth: 1,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: s.lg,
    borderRadius: r.lg,
    gap: s.sm,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '700',
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
  generateButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
  },
});
