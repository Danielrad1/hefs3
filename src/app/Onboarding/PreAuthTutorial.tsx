import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  withSpring,
  interpolate,
  Extrapolate,
  SharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../design/theme';
import { s } from '../../design/spacing';
import PrimaryButton from '../../components/PrimaryButton';

const { width } = Dimensions.get('window');

interface TutorialSlide {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  color: string;
}

const TUTORIAL_SLIDES: TutorialSlide[] = [
  {
    icon: 'trending-up',
    title: 'Study Less, Learn More',
    description: 'A daily plan tuned for your memory so you make progress without the grind.',
    color: '#7C3AED',
  },
  {
    icon: 'stats-chart',
    title: 'Right Card. Right Time.',
    description: 'Cards surface just before forgetting, adapting to your pace and difficulty.',
    color: '#22D3EE',
  },
  {
    icon: 'flash',
    title: 'Hints That Teach',
    description: 'Tap to reveal step-by-step hints and explanations so answers stick.',
    color: '#F59E0B',
  },
  {
    icon: 'library',
    title: 'Start With Wins',
    description: "We'll build your first micro-deck and let you master the first cards in minutes.",
    color: '#10B981',
  },
];

interface PreAuthTutorialProps {
  onComplete: () => void;
}

export default function PreAuthTutorial({ onComplete }: PreAuthTutorialProps) {
  const theme = useTheme();
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useSharedValue(0);

  const isLastSlide = currentIndex === TUTORIAL_SLIDES.length - 1;

  const handleNext = () => {
    if (isLastSlide) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onComplete();
    } else {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      scrollX.value = withSpring(nextIndex);
      Haptics.selectionAsync();
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  const handleDotPress = (index: number) => {
    setCurrentIndex(index);
    scrollX.value = withSpring(index);
    Haptics.selectionAsync();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      {/* Skip Button */}
      <Pressable style={styles.skipButton} onPress={handleSkip}>
        <Text style={[styles.skipText, { color: theme.colors.textTertiary }]}>
          Skip
        </Text>
      </Pressable>

      <View style={styles.content}>
        {/* Slides */}
        <View style={styles.slidesContainer}>
          {TUTORIAL_SLIDES.map((slide, index) => (
            <TutorialSlideView
              key={index}
              slide={slide}
              index={index}
              currentSlide={currentIndex}
              slideProgress={scrollX}
              theme={theme}
            />
          ))}
        </View>

        {/* Pagination Dots */}
        <View style={styles.pagination}>
          {TUTORIAL_SLIDES.map((_, index) => (
            <Pressable
              key={index}
              onPress={() => handleDotPress(index)}
            >
              <Animated.View
                style={[
                  styles.dot,
                  {
                    backgroundColor: index === currentIndex ? theme.colors.accent : theme.colors.border,
                    width: index === currentIndex ? 28 : 8,
                  },
                ]}
              />
            </Pressable>
          ))}
        </View>

        {/* Next/Get Started Button */}
        <View style={styles.actions}>
          <PrimaryButton
            title={isLastSlide ? "Get Started" : 'Next →'}
            onPress={handleNext}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

interface TutorialSlideViewProps {
  slide: TutorialSlide;
  index: number;
  currentSlide: number;
  slideProgress: SharedValue<number>;
  theme: any;
}

function TutorialSlideView({ slide, index, currentSlide, slideProgress, theme }: TutorialSlideViewProps) {
  // Enhanced animations with bounce, rotation, and scale
  const iconAnimatedStyle = useAnimatedStyle(() => {
    const inputRange = [index - 1, index, index + 1];
    
    const translateY = interpolate(
      slideProgress.value,
      inputRange,
      [50, 0, -50],
      Extrapolate.CLAMP
    );

    const scale = interpolate(
      slideProgress.value,
      inputRange,
      [0.6, 1, 0.6],
      Extrapolate.CLAMP
    );

    const rotate = interpolate(
      slideProgress.value,
      inputRange,
      [-15, 0, 15],
      Extrapolate.CLAMP
    );

    const opacity = interpolate(
      slideProgress.value,
      inputRange,
      [0, 1, 0],
      Extrapolate.CLAMP
    );

    return {
      transform: [
        { translateY },
        { scale },
        { rotate: `${rotate}deg` },
      ],
      opacity,
    };
  });

  const textAnimatedStyle = useAnimatedStyle(() => {
    const inputRange = [index - 1, index, index + 1];
    
    const translateY = interpolate(
      slideProgress.value,
      inputRange,
      [30, 0, -30],
      Extrapolate.CLAMP
    );

    const opacity = interpolate(
      slideProgress.value,
      inputRange,
      [0, 1, 0],
      Extrapolate.CLAMP
    );

    return {
      transform: [{ translateY }],
      opacity,
    };
  });

  const containerAnimatedStyle = useAnimatedStyle(() => {
    const inputRange = [index - 1, index, index + 1];
    
    const scale = interpolate(
      slideProgress.value,
      inputRange,
      [0.9, 1, 0.9],
      Extrapolate.CLAMP
    );

    return {
      transform: [{ scale }],
    };
  });

  // Only render slides close to current to optimize performance
  if (Math.abs(index - currentSlide) > 1) {
    return null;
  }

  return (
    <Animated.View style={[styles.slide, containerAnimatedStyle]}>
      {/* Glow ring behind icon */}
      <Animated.View style={[styles.glowRing, { backgroundColor: slide.color + '15' }, iconAnimatedStyle]} />
      
      <Animated.View style={[styles.iconContainer, { backgroundColor: slide.color + '20' }, iconAnimatedStyle]}>
        <Ionicons name={slide.icon} size={96} color={slide.color} />
      </Animated.View>
      
      <Animated.View style={textAnimatedStyle}>
        <Text style={[styles.slideTitle, { color: theme.colors.textPrimary }]}>
          {slide.title}
        </Text>
        <Text style={[styles.slideDescription, { color: theme.colors.textSecondary }]}>
          {slide.description}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  skipButton: {
    position: 'absolute',
    top: s.xl,
    right: s.xl,
    zIndex: 10,
    padding: s.sm,
  },
  skipText: {
    fontSize: 16,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingBottom: s.xl,
  },
  slidesContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  slide: {
    position: 'absolute',
    width: width - s.xl * 2,
    alignItems: 'center',
    paddingHorizontal: s.xl,
  },
  glowRing: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    marginBottom: s.xl * 2,
  },
  iconContainer: {
    width: 200,
    height: 200,
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: s.xl * 2,
  },
  slideTitle: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: s.lg,
    textAlign: 'center',
    lineHeight: 38,
  },
  slideDescription: {
    fontSize: 17,
    lineHeight: 26,
    textAlign: 'center',
    maxWidth: 360,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: s.sm,
    paddingVertical: s.xl,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  actions: {
    paddingHorizontal: s.xl,
  },
});
