import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../design/theme';
import { s } from '../../design/spacing';
import { r } from '../../design/radii';
import PrimaryButton from '../../components/PrimaryButton';

interface StudyGoalScreenProps {
  onContinue: (goalMinutes: number) => void;
  onBack: () => void;
}

const GOAL_OPTIONS = [
  { value: 5, label: '5 min', description: 'Quick review' },
  { value: 10, label: '10 min', description: 'Light session' },
  { value: 15, label: '15 min', description: 'Recommended' },
  { value: 20, label: '20 min', description: 'Solid practice' },
  { value: 30, label: '30 min', description: 'Deep focus' },
  { value: 45, label: '45 min', description: 'Power session' },
  { value: 60, label: '60 min', description: 'Marathon' },
];

export default function StudyGoalScreen({ onContinue, onBack }: StudyGoalScreenProps) {
  const theme = useTheme();
  const [selectedGoal, setSelectedGoal] = useState(15);

  const handleSelect = (value: number) => {
    setSelectedGoal(value);
    Haptics.selectionAsync();
  };

  const handleContinue = () => {
    onContinue(selectedGoal);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={onBack} style={{ padding: s.sm }}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </Pressable>
        <Text style={[styles.stepText, { color: theme.colors.textTertiary }]}>
          Step 2 of 4
        </Text>
      </View>

      {/* Scrollable Content */}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Title Section */}
        <View style={styles.titleSection}>
          <View style={[styles.iconContainer, { backgroundColor: theme.colors.accent + '20' }]}>
            <Ionicons name="time" size={32} color={theme.colors.accent} />
          </View>
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
            Daily Study Goal
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            How much time do you want to study each day?
          </Text>
        </View>

        {/* Goal Options */}
        <View style={styles.optionsContainer}>
          {GOAL_OPTIONS.map((option) => (
            <Pressable
              key={option.value}
              style={({ pressed }) => [
                styles.optionCard,
                {
                  backgroundColor: selectedGoal === option.value ? theme.colors.accent + '15' : theme.colors.surface,
                  borderColor: selectedGoal === option.value ? theme.colors.accent : theme.colors.border,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
              onPress={() => handleSelect(option.value)}
            >
              <View style={styles.optionContent}>
                <Text style={[
                  styles.optionLabel,
                  { color: selectedGoal === option.value ? theme.colors.accent : theme.colors.textPrimary }
                ]}>
                  {option.label}
                </Text>
                <Text style={[styles.optionDescription, { color: theme.colors.textSecondary }]}>
                  {option.description}
                </Text>
              </View>
              {selectedGoal === option.value && (
                <Ionicons name="checkmark-circle" size={24} color={theme.colors.accent} />
              )}
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {/* Fixed Bottom Button */}
      <View style={[styles.footer, { backgroundColor: theme.colors.bg, borderTopColor: theme.colors.border }]}>
        <PrimaryButton
          title="Continue →"
          onPress={handleContinue}
        />
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
  stepText: {
    fontSize: 14,
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: s.xl,
    paddingBottom: s.xl,
  },
  titleSection: {
    alignItems: 'center',
    paddingTop: s.lg,
    paddingBottom: s.xl,
    gap: s.sm,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: r.xl,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: s.xs,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: s.xs,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 21,
  },
  optionsContainer: {
    gap: s.sm,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: s.lg,
    borderRadius: r.lg,
    borderWidth: 2,
  },
  optionContent: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: s.xs,
  },
  optionDescription: {
    fontSize: 14,
  },
  footer: {
    paddingHorizontal: s.xl,
    paddingVertical: s.lg,
    paddingBottom: s.xl,
    borderTopWidth: 1,
  },
});
