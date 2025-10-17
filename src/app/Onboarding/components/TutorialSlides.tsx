import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../design/theme';
import { s } from '../../../design/spacing';
import { r } from '../../../design/radii';
import PrimaryButton from '../../../components/PrimaryButton';

interface TutorialSlidesProps {
  slideIndex: number;
  onNext: () => void;
  onBack?: () => void;
}

const SLIDES = [
  {
    icon: 'library' as const,
    title: 'Master Anything—Faster',
    description: 'Less time, less effort, more retained—vs. typical flashcard apps.',
    color: '#6EE7F2',
  },
  {
    icon: 'trending-up' as const,
    title: 'Remember 2–3× Longer',
    description: 'Proprietary scheduling + AI timing outperforms generic SRS.',
    color: '#9D7FF5',
  },
  {
    icon: 'flash' as const,
    title: 'Consistency Without Burnout',
    description: 'A daily plan with fewer reviews than most apps.',
    color: '#FFD166',
  },
  {
    icon: 'stats-chart' as const,
    title: 'Proof You’re Winning',
    description: 'Modern analytics others miss: retention, streaks, time saved.',
    color: '#06D6A0',
  },
];

export default function TutorialSlides({ slideIndex, onNext }: TutorialSlidesProps) {
  const theme = useTheme();
  const slide = SLIDES[slideIndex];

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.slideContent}>
          <View style={[styles.iconContainer, { backgroundColor: slide.color + '20' }]}>
            <Ionicons name={slide.icon} size={64} color={slide.color} />
          </View>
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
            {slide.title}
          </Text>
          <Text style={[styles.description, { color: theme.colors.textSecondary }]}>
            {slide.description}
          </Text>
        </View>
      </View>

      <View style={[styles.footer, { backgroundColor: theme.colors.bg }]}>
        <PrimaryButton
          title={slideIndex === 3 ? "Let's Start!" : 'Next'}
          onPress={onNext}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: s.xl,
  },
  slideContent: {
    alignItems: 'center',
    maxWidth: 400,
  },
  iconContainer: {
    width: 144,
    height: 144,
    borderRadius: r.xl,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: s.xl * 2,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: s.lg,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: s.xl,
    paddingVertical: s.lg,
    paddingBottom: s.xl,
  },
});
