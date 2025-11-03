import React from 'react';
import { View, Text, StyleSheet, TextInput } from 'react-native';
import { useTheme } from '../../../design/theme';
import { s } from '../../../design/spacing';
import { r } from '../../../design/radii';

interface InstructionsStepProps {
  prompt: string;
  onPromptChange: (text: string) => void;
  placeholder: string;
  hasFiles: boolean;
}

export default function InstructionsStep({ prompt, onPromptChange, placeholder, hasFiles }: InstructionsStepProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <View style={styles.inputHeader}>
        <Text style={[styles.inputLabel, { color: theme.colors.textPrimary }]}>
          {hasFiles ? 'How do you like your cards?' : 'What do you want to learn?'}
        </Text>
        <Text style={[styles.inputHint, { color: theme.colors.textSecondary }]}>
          {hasFiles
            ? 'Describe any specific preferences for how cards should be formatted (optional)'
            : 'Describe the topic and what you want to learn'}
        </Text>
      </View>

      <TextInput
        style={[
          styles.promptTextArea,
          {
            backgroundColor: theme.colors.surface2,
            color: theme.colors.textHigh,
            borderWidth: 1,
            borderColor: theme.colors.border,
          },
        ]}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textMed}
        value={prompt}
        onChangeText={onPromptChange}
        multiline
        numberOfLines={10}
        textAlignVertical="top"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: s.lg,
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
  promptTextArea: {
    borderRadius: r.lg,
    padding: s.lg,
    fontSize: 16,
    minHeight: 200,
    lineHeight: 22,
  },
});
