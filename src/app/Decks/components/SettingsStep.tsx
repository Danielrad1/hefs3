import React from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../design/theme';
import { s } from '../../../design/spacing';
import { r } from '../../../design/radii';
import { InstructionOptions } from '../../../services/ai/promptBuilders';

interface SettingsStepProps {
  instructions: InstructionOptions;
  onInstructionsChange: (instructions: InstructionOptions) => void;
  itemLimit: string;
  onCountChange: (count: string) => void;
  isPremiumEffective: boolean;
  onShowPremiumModal: () => void;
  hasFiles: boolean;
}

export default function SettingsStep({
  instructions,
  onInstructionsChange,
  itemLimit,
  onCountChange,
  isPremiumEffective,
  onShowPremiumModal,
  hasFiles,
}: SettingsStepProps) {
  const theme = useTheme();

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled
    >
      {/* Number of Cards */}
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: theme.colors.textPrimary }]}>
          Number of Cards
        </Text>
        <View style={styles.countOptions}>
          {['25', '50', '75', '100'].map((count) => {
            const countNum = parseInt(count);
            const isLocked = !isPremiumEffective && countNum > 25;
            const isSelected = itemLimit === count;
            return (
              <Pressable
                key={count}
                style={[
                  styles.countOption,
                  isSelected
                    ? {
                        backgroundColor: theme.colors.overlay.primary,
                        borderColor: theme.colors.primary,
                      }
                    : {
                        backgroundColor: theme.colors.surface2,
                        borderColor: theme.colors.border,
                      },
                  isLocked && { opacity: 0.6 },
                ]}
                onPress={() => {
                  if (isLocked) {
                    onShowPremiumModal();
                  } else {
                    onCountChange(count);
                  }
                }}
                disabled={false}
              >
                {isLocked && (
                  <View style={[styles.proBadge, { backgroundColor: theme.colors.warning }]}>
                    <Ionicons name="lock-closed" size={10} color="#fff" />
                  </View>
                )}
                <Text
                  style={[
                    styles.countText,
                    isSelected
                      ? { color: theme.colors.primary }
                      : { color: theme.colors.textHigh },
                  ]}
                >
                  {count}
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            style={[
              styles.countOption,
              {
                backgroundColor: !['25', '50', '75', '100'].includes(itemLimit)
                  ? theme.colors.overlay.primary
                  : theme.colors.surface2,
                borderColor: !['25', '50', '75', '100'].includes(itemLimit)
                  ? theme.colors.primary
                  : theme.colors.border,
                opacity: !isPremiumEffective ? 0.6 : 1,
              },
            ]}
            onPress={() => {
              if (!isPremiumEffective) {
                onShowPremiumModal();
                return;
              }
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
                        onCountChange(value || '50');
                      }
                    },
                  },
                ],
                'plain-text',
                itemLimit,
                'number-pad'
              );
            }}
            disabled={false}
          >
            {!isPremiumEffective && (
              <View style={[styles.proBadge, { backgroundColor: theme.colors.warning }]}>
                <Ionicons name="lock-closed" size={10} color="#fff" />
                <Text style={styles.proBadgeText}>PRO</Text>
              </View>
            )}
            <Text
              style={[
                styles.countText,
                {
                  color: !['25', '50', '75', '100'].includes(itemLimit)
                    ? theme.colors.primary
                    : theme.colors.textHigh,
                },
              ]}
            >
              {!['25', '50', '75', '100'].includes(itemLimit) ? itemLimit : 'Custom'}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Card Format */}
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: theme.colors.textPrimary }]}>
          Card Format
        </Text>
        <View style={styles.segmentedControl}>
          <Pressable
            style={[
              styles.segment,
              instructions.cardFormat === 'basic' && { backgroundColor: theme.colors.primary },
              { borderColor: theme.colors.border },
            ]}
            onPress={() => onInstructionsChange({ ...instructions, cardFormat: 'basic' })}
          >
            <Text
              style={[
                styles.segmentText,
                instructions.cardFormat === 'basic'
                  ? { color: '#fff' }
                  : { color: theme.colors.textMed },
              ]}
            >
              Basic
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.segment,
              instructions.cardFormat === 'cloze' && { backgroundColor: theme.colors.primary },
              { borderColor: theme.colors.border },
            ]}
            onPress={() => onInstructionsChange({ ...instructions, cardFormat: 'cloze' })}
          >
            <Text
              style={[
                styles.segmentText,
                instructions.cardFormat === 'cloze'
                  ? { color: '#fff' }
                  : { color: theme.colors.textMed },
              ]}
            >
              Cloze
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Detail Level */}
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: theme.colors.textPrimary }]}>
          Detail Level
        </Text>
        <View style={styles.segmentedControl}>
          {(['low', 'medium', 'high'] as const).map((level) => (
            <Pressable
              key={level}
              style={[
                styles.segment,
                instructions.detailLevel === level && { backgroundColor: theme.colors.primary },
                { borderColor: theme.colors.border },
              ]}
              onPress={() => onInstructionsChange({ ...instructions, detailLevel: level })}
            >
              <Text
                style={[
                  styles.segmentText,
                  instructions.detailLevel === level
                    ? { color: '#fff' }
                    : { color: theme.colors.textMed },
                ]}
              >
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Tone */}
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: theme.colors.textPrimary }]}>Tone</Text>
        <View style={styles.segmentedControl}>
          {(['concise', 'comprehensive', 'exam'] as const).map((tone) => (
            <Pressable
              key={tone}
              style={[
                styles.segment,
                instructions.tone === tone && { backgroundColor: theme.colors.primary },
                { borderColor: theme.colors.border },
              ]}
              onPress={() => onInstructionsChange({ ...instructions, tone })}
            >
              <Text
                style={[
                  styles.segmentText,
                  instructions.tone === tone
                    ? { color: '#fff' }
                    : { color: theme.colors.textMed },
                ]}
              >
                {tone.charAt(0).toUpperCase() + tone.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Formatting Options */}
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: theme.colors.textPrimary }]}>
          Formatting
        </Text>
        {[
          { key: 'bold_key_terms', label: 'Bold key terms' },
          { key: 'lists', label: 'Use lists when appropriate' },
          { key: 'code', label: 'Format code blocks' },
          { key: 'math', label: 'Format math as HTML' },
        ].map((option) => (
          <Pressable
            key={option.key}
            style={styles.checkboxRow}
            onPress={() => {
              const current = instructions.formatting || [];
              const newFormatting = current.includes(option.key)
                ? current.filter((f) => f !== option.key)
                : [...current, option.key];
              onInstructionsChange({ ...instructions, formatting: newFormatting });
            }}
          >
            <View
              style={[
                styles.checkbox,
                {
                  borderColor: theme.colors.border,
                  backgroundColor: instructions.formatting?.includes(option.key)
                    ? theme.colors.primary
                    : 'transparent',
                },
              ]}
            >
              {instructions.formatting?.includes(option.key) && (
                <Ionicons name="checkmark" size={16} color="#fff" />
              )}
            </View>
            <Text style={[styles.checkboxLabel, { color: theme.colors.textMed }]}>
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Chunking Strategy - Only for files */}
      {hasFiles && (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.colors.textPrimary }]}>
            Chunking Strategy
          </Text>
          {[
            { key: 'auto', label: 'Auto' },
            { key: 'by_heading', label: 'By Heading' },
            { key: 'by_paragraph', label: 'By Paragraph' },
          ].map((option) => (
            <Pressable
              key={option.key}
              style={styles.radioRow}
              onPress={() =>
                onInstructionsChange({
                  ...instructions,
                  chunking: { ...instructions.chunking, strategy: option.key as any },
                })
              }
            >
              <View
                style={[
                  styles.radio,
                  {
                    borderColor: theme.colors.border,
                    backgroundColor:
                      instructions.chunking.strategy === option.key
                        ? theme.colors.primary
                        : 'transparent',
                  },
                ]}
              >
                {instructions.chunking.strategy === option.key && (
                  <View style={[styles.radioInner, { backgroundColor: '#fff' }]} />
                )}
              </View>
              <Text style={[styles.radioLabel, { color: theme.colors.textMed }]}>
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: s.lg,
  },
  section: {
    marginBottom: s.lg,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: s.sm,
  },
  segmentedControl: {
    flexDirection: 'row',
    gap: s.xs,
  },
  segment: {
    flex: 1,
    paddingVertical: s.md,
    paddingHorizontal: s.sm,
    borderRadius: r.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: s.sm,
    gap: s.md,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: r.sm,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxLabel: {
    fontSize: 15,
    flex: 1,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: s.sm,
    gap: s.md,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  radioLabel: {
    fontSize: 15,
    flex: 1,
  },
  textInput: {
    borderRadius: r.md,
    borderWidth: 1,
    padding: s.md,
    fontSize: 15,
  },
  countOptions: {
    flexDirection: 'row',
    gap: s.xs,
  },
  countOption: {
    flex: 1,
    paddingVertical: s.md,
    paddingHorizontal: s.xs,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  proBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#fff',
  },
});
