import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { 
  useAnimatedStyle, 
  withSpring,
  interpolate,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../../design/theme';
import { s } from '../../../design/spacing';
import { r } from '../../../design/radii';
import PrimaryButton from '../../../components/PrimaryButton';

interface StudyGoalStepProps {
  onNext: (data: { goalMinutes: number }) => void;
  onBack?: () => void;
}

interface GoalOption {
  value: number;
  label: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  gradient: [string, string];
  emoji: string;
}

const GOAL_OPTIONS: GoalOption[] = [
  {
    value: 5,
    label: '5 min',
    subtitle: 'Quick review',
    icon: 'flash',
    gradient: ['#FFD166', '#F97316'],
    emoji: '',
  },
  {
    value: 10,
    label: '10 min',
    subtitle: 'Light session',
    icon: 'sunny',
    gradient: ['#FCD34D', '#F59E0B'],
    emoji: '',
  },
  {
    value: 15,
    label: '15 min',
    subtitle: 'Recommended',
    icon: 'star',
    gradient: ['#8B5CF6', '#6366F1'],
    emoji: '',
  },
  {
    value: 20,
    label: '20 min',
    subtitle: 'Solid practice',
    icon: 'trophy',
    gradient: ['#06B6D4', '#3B82F6'],
    emoji: '',
  },
  {
    value: 30,
    label: '30 min',
    subtitle: 'Deep focus',
    icon: 'flame',
    gradient: ['#F97316', '#DC2626'],
    emoji: '',
  },
];

export default function StudyGoalStep({ onNext, onBack }: StudyGoalStepProps) {
  const theme = useTheme();
  const [selected, setSelected] = useState(15);

  const handleSelect = (value: number) => {
    setSelected(value);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleContinue = () => {
    onNext({ goalMinutes: selected });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      {onBack && (
        <Pressable onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </Pressable>
      )}

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
            Daily Study Goal
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            How much time do you want to study each day?
          </Text>
        </View>

        {/* Goal Cards */}
        <View style={styles.goalsContainer}>
          {GOAL_OPTIONS.map((option) => {
            const isSelected = selected === option.value;
            const isRecommended = option.value === 15;

            return (
              <Pressable
                key={option.value}
                onPress={() => handleSelect(option.value)}
                style={({ pressed }) => [
                  styles.goalCard,
                  {
                    opacity: pressed ? 0.8 : 1,
                    transform: [{ scale: isSelected ? 1.02 : 1 }],
                  },
                ]}
              >
                <LinearGradient
                  colors={isSelected ? option.gradient : [theme.colors.surface, theme.colors.surface]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[
                    styles.goalGradient,
                    {
                      borderColor: isSelected ? option.gradient[0] : theme.colors.border,
                      borderWidth: isSelected ? 3 : 1.5,
                    },
                  ]}
                >
                  {/* Icon */}
                  <View style={[
                    styles.iconBadge,
                    { backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : theme.colors.surface }
                  ]}>
                    <Ionicons 
                      name={option.icon} 
                      size={28} 
                      color={isSelected ? '#FFFFFF' : option.gradient[0]} 
                    />
                  </View>

                  {/* Content */}
                  <View style={styles.goalContent}>
                    <Text style={[
                      styles.goalLabel,
                      { color: isSelected ? '#FFFFFF' : theme.colors.textPrimary }
                    ]}>
                      {option.label}
                    </Text>
                    <Text style={[
                      styles.goalSubtitle,
                      { color: isSelected ? 'rgba(255,255,255,0.9)' : theme.colors.textSecondary }
                    ]}>
                      {option.subtitle}
                    </Text>
                  </View>

                  {/* Checkmark */}
                  {isSelected && (
                    <View style={styles.checkmark}>
                      <Ionicons name="checkmark-circle" size={28} color="#FFFFFF" />
                    </View>
                  )}

                  {/* Recommended Badge */}
                  {isRecommended && !isSelected && (
                    <View style={[styles.recommendedBadge, { backgroundColor: theme.colors.accent }]}>
                      <Text style={styles.recommendedText}>Recommended</Text>
                    </View>
                  )}
                </LinearGradient>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* Fixed Bottom Button */}
      <View style={[styles.footer, { backgroundColor: theme.colors.bg, borderTopColor: theme.colors.border }]}>
        <PrimaryButton
          title="Continue →"
          onPress={handleContinue}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backButton: {
    padding: s.md,
    paddingLeft: s.lg,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: s.xl,
    paddingBottom: s.xl,
  },
  header: {
    paddingTop: s.md,
    paddingBottom: s.xl,
    gap: s.sm,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 17,
    lineHeight: 24,
  },
  goalsContainer: {
    gap: s.md,
  },
  goalCard: {
    borderRadius: r.xl,
    overflow: 'hidden',
  },
  goalGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: s.lg,
    borderRadius: r.xl,
    minHeight: 88,
    gap: s.lg,
  },
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: r.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  goalContent: {
    flex: 1,
    gap: s.xs,
  },
  goalLabel: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  goalSubtitle: {
    fontSize: 15,
    fontWeight: '500',
  },
  checkmark: {
    marginLeft: 'auto',
  },
  recommendedBadge: {
    position: 'absolute',
    top: s.sm,
    right: s.sm,
    paddingHorizontal: s.md,
    paddingVertical: s.xs,
    borderRadius: r.md,
  },
  recommendedText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  footer: {
    paddingHorizontal: s.xl,
    paddingVertical: s.lg,
    paddingBottom: s.xl,
    borderTopWidth: 1,
  },
});
