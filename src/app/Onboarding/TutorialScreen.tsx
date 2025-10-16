import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, Pressable, Alert } from 'react-native';
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
import { r } from '../../design/radii';
import PrimaryButton from '../../components/PrimaryButton';
import { useAuth } from '../../context/AuthContext';
import { UserPrefsService } from '../../services/onboarding/UserPrefsService';

const { width } = Dimensions.get('window');

interface TutorialSlide {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  color: string;
}

const TUTORIAL_SLIDES: TutorialSlide[] = [
  {
    icon: 'library',
    title: 'Create Your Decks',
    description: 'Organize flashcards into decks by topic. Import from Anki or create from scratch with AI assistance.',
    color: '#6EE7F2',
  },
  {
    icon: 'trending-up',
    title: 'Spaced Repetition',
    description: 'Our algorithm shows you cards right before you forget them, maximizing retention with minimal effort.',
    color: '#9D7FF5',
  },
  {
    icon: 'flash',
    title: 'Study Smart',
    description: 'Swipe through cards and rate difficulty. Again, Hard, Good, or Easy - the algorithm adapts to you.',
    color: '#FFD166',
  },
  {
    icon: 'stats-chart',
    title: 'Track Progress',
    description: 'View detailed analytics, retention curves, and streaks. Watch your knowledge compound over time.',
    color: '#06D6A0',
  },
];

interface TutorialScreenProps {
  onComplete?: () => void;
}

export default function TutorialScreen({ onComplete }: TutorialScreenProps) {
  const theme = useTheme();
  const { user } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const scrollX = useSharedValue(0);

  const isLastSlide = currentIndex === TUTORIAL_SLIDES.length - 1;

  const handleNext = () => {
    if (saving) return; // Prevent double-tap during save
    
    if (isLastSlide) {
      handleComplete();
    } else {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      scrollX.value = withSpring(nextIndex);
      Haptics.selectionAsync();
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = async () => {
    if (!user?.uid) {
      Alert.alert('Error', 'No user found. Please sign in again.');
      return;
    }

    try {
      setSaving(true);
      
      // Haptic feedback on completion
      if (isLastSlide) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      // Mark tutorial as completed
      await UserPrefsService.setTutorialCompleted(user.uid);

      // Notify parent (AuthNavigator) that tutorial is complete
      onComplete?.();
    } catch (error) {
      console.error('[Tutorial] Error completing tutorial:', error);
      Alert.alert('Error', 'Failed to save tutorial progress. Please try again.');
      setSaving(false);
    }
  };

  const handleDotPress = (index: number) => {
    setCurrentIndex(index);
    scrollX.value = withSpring(index);
    Haptics.selectionAsync();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      {/* Skip Button */}
      <Pressable style={styles.skipButton} onPress={handleSkip} disabled={saving}>
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
              disabled={saving}
            >
              <Animated.View
                style={[
                  styles.dot,
                  {
                    backgroundColor: index === currentIndex ? theme.colors.accent : theme.colors.border,
                    width: index === currentIndex ? 24 : 8,
                  },
                ]}
              />
            </Pressable>
          ))}
        </View>

        {/* Next/Start Button */}
        <View style={styles.actions}>
          <PrimaryButton
            title={isLastSlide ? "Let's Start!" : 'Next'}
            onPress={saving ? undefined : handleNext}
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
  const animatedStyle = useAnimatedStyle(() => {
    const inputRange = [index - 1, index, index + 1];
    
    const opacity = interpolate(
      slideProgress.value,
      inputRange,
      [0, 1, 0],
      Extrapolate.CLAMP
    );

    const translateX = interpolate(
      slideProgress.value,
      inputRange,
      [width, 0, -width],
      Extrapolate.CLAMP
    );

    const scale = interpolate(
      slideProgress.value,
      inputRange,
      [0.8, 1, 0.8],
      Extrapolate.CLAMP
    );

    return {
      opacity,
      transform: [{ translateX }, { scale }],
    };
  });

  // Only render slides close to current to optimize performance
  if (Math.abs(index - currentSlide) > 1) {
    return null;
  }

  return (
    <Animated.View style={[styles.slide, animatedStyle]}>
      <View style={[styles.iconContainer, { backgroundColor: slide.color + '20' }]}>
        <Ionicons name={slide.icon} size={64} color={slide.color} />
      </View>
      <Text style={[styles.slideTitle, { color: theme.colors.textPrimary }]}>
        {slide.title}
      </Text>
      <Text style={[styles.slideDescription, { color: theme.colors.textSecondary }]}>
        {slide.description}
      </Text>
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
  iconContainer: {
    width: 144,
    height: 144,
    borderRadius: r.xl,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: s.xl * 2,
  },
  slideTitle: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: s.lg,
    textAlign: 'center',
  },
  slideDescription: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    maxWidth: 320,
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
