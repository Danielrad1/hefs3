import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../design/theme';
import { s } from '../../../design/spacing';
import { r } from '../../../design/radii';

interface ChoiceStepProps {
  onChooseWithFiles: () => void;
  onChooseWithoutFiles: () => void;
}

export default function ChoiceStep({ onChooseWithFiles, onChooseWithoutFiles }: ChoiceStepProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
          How would you like to create your deck?
        </Text>
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
          Choose your starting point
        </Text>
      </View>

      <View style={styles.options}>
        <Pressable
          style={[
            styles.optionCard,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
          onPress={onChooseWithFiles}
        >
          <View style={[styles.iconCircle, { backgroundColor: theme.colors.overlay.primary }]}>
            <Ionicons name="document-attach" size={32} color={theme.colors.primary} />
          </View>
          <Text style={[styles.optionTitle, { color: theme.colors.textHigh }]}>
            Import Files
          </Text>
          <Text style={[styles.optionDesc, { color: theme.colors.textMed }]}>
            Upload PDFs, documents, or notes to generate cards from your content
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.optionCard,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
          onPress={onChooseWithoutFiles}
        >
          <View style={[styles.iconCircle, { backgroundColor: theme.colors.overlay.primary }]}>
            <Ionicons name="text" size={32} color={theme.colors.primary} />
          </View>
          <Text style={[styles.optionTitle, { color: theme.colors.textHigh }]}>
            Describe Topic
          </Text>
          <Text style={[styles.optionDesc, { color: theme.colors.textMed }]}>
            Simply describe what you want to learn and let AI create the cards
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: s.xl,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: s['2xl'],
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: s.sm,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  options: {
    gap: s.lg,
  },
  optionCard: {
    padding: s.xl,
    borderRadius: r.xl,
    borderWidth: 2,
    alignItems: 'center',
    gap: s.md,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: s.sm,
  },
  optionTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  optionDesc: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
});
