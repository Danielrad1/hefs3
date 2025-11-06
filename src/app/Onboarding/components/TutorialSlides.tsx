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
    icon: 'trending-up' as const,
    title: 'Study Less, Learn More',
    description: 'A daily plan tuned for your memory so you make progress without the grind.',
    color: '#7C3AED',
  },
  {
    icon: 'stats-chart' as const,
    title: 'Right Card. Right Time.',
    description: 'Cards surface just before forgetting, adapting to your pace and difficulty.',
    color: '#22D3EE',
  },
  {
    icon: 'flash' as const,
    title: 'Hints That Teach',
    description: 'Tap to reveal step-by-step hints and explanations so answers stick.',
    color: '#F59E0B',
  },
  {
    icon: 'library' as const,
    title: 'Start With Wins',
    description: "We'll build your first micro-deck and let you master the first cards in minutes.",
    color: '#10B981',
  },
];

export default function TutorialSlides({ slideIndex, onNext }: TutorialSlidesProps) {
  const theme = useTheme();
  const slide = SLIDES[slideIndex];

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      <View style={styles.content}>
        <View style={styles.slideContent}>
          {/* Glow ring behind icon */}
          <View style={[styles.glowRing, { backgroundColor: slide.color + '15' }]} />
          
          <View style={[styles.iconContainer, { backgroundColor: slide.color + '20' }]}>
            <Ionicons name={slide.icon} size={96} color={slide.color} />
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
          title={slideIndex === 3 ? "Let's Start!" : 'Next →'}
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
  glowRing: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    top: -10,
  },
  iconContainer: {
    width: 200,
    height: 200,
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: s.xl * 2,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: s.lg,
    textAlign: 'center',
    lineHeight: 38,
  },
  description: {
    fontSize: 17,
    lineHeight: 26,
    textAlign: 'center',
    maxWidth: 360,
  },
  footer: {
    paddingHorizontal: s.xl,
    paddingVertical: s.lg,
    paddingBottom: s.xl,
  },
});
