import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolate,
  useAnimatedReaction,
} from 'react-native-reanimated';
import { useTheme } from '../../design';
import { s } from '../../design/spacing';
import { r } from '../../design/radii';
import { sh } from '../../design/shadows';
import { Card } from '../../domain/models';
import { Difficulty } from '../../domain/srsTypes';
import { useHaptics } from '../../hooks/useHaptics';

const { height, width } = Dimensions.get('window');

const SWIPE_THRESHOLD = 80;

type CardPageProps = {
  card: Card;
  onAnswer: (difficulty: Difficulty) => void;
  onSwipeChange?: (translateX: number, translateY: number, isRevealed: boolean) => void;
  isCurrent?: boolean;
  onReveal?: () => void;
};

export default function CardPage({ card, onAnswer, onSwipeChange, isCurrent = false, onReveal }: CardPageProps) {
  const theme = useTheme();
  const { selection } = useHaptics();
  
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const isRevealed = useSharedValue(false);
  const revealProgress = useSharedValue(0);
  const shadowProgress = useSharedValue(0);

  React.useEffect(() => {
    // Animate shadow in when card becomes current
    if (isCurrent) {
      shadowProgress.value = withTiming(1, { duration: 1000 });
    } else {
      shadowProgress.value = withTiming(0, { duration:1000 });
    }
  }, [isCurrent, shadowProgress]);

  const handleReveal = () => {
    'worklet';
    if (!isRevealed.value) {
      isRevealed.value = true;
      if (onReveal) {
        runOnJS(onReveal)();
      }
    }
  };

  const handleToggle = () => {
    'worklet';
    // Toggle between question and answer
    if (revealProgress.value === 0) {
      // Show answer
      revealProgress.value = withTiming(1, {
        duration: 900,
      });
      runOnJS(selection)();
      handleReveal();
    } else {
      // Show question
      revealProgress.value = withTiming(0, {
        duration: 900,
      });
      runOnJS(selection)();
    }
  };

  const handleAnswer = (difficulty: Difficulty) => {
    'worklet';
    runOnJS(onAnswer)(difficulty);
  };

  // Tap to toggle between question/answer, pan to rate
  const tapGesture = Gesture.Tap()
    .onEnd(() => {
      'worklet';
      handleToggle();
    });

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      'worklet';
      // Only allow rating swipes when answer is fully visible
      if (isRevealed.value && revealProgress.value === 1) {
        // After reveal, allow all directional swipes
        translateX.value = event.translationX;
        translateY.value = event.translationY;
        
        // Notify parent of swipe position for screen overlay
        if (onSwipeChange) {
          runOnJS(onSwipeChange)(event.translationX, event.translationY, true);
        }
      }
    })
    .onEnd((event) => {
      if (isRevealed.value && revealProgress.value === 1) {
        // Check which direction was swiped
        const absX = Math.abs(event.translationX);
        const absY = Math.abs(event.translationY);
        
        if (absX > SWIPE_THRESHOLD || absY > SWIPE_THRESHOLD) {
          // Determine direction and fling card off screen quickly
          let difficulty: Difficulty;
          
          if (absY > absX) {
            // Vertical swipe
            if (event.translationY > 0) {
              // Down = Again
              difficulty = 'again';
              translateY.value = withTiming(height * 1.5, { duration: 250 });
            } else {
              // Up = Good
              difficulty = 'good';
              translateY.value = withTiming(-height * 1.5, { duration: 250 });
            }
          } else {
            // Horizontal swipe
            if (event.translationX > 0) {
              // Right = Easy
              difficulty = 'easy';
              translateX.value = withTiming(width * 1.5, { duration: 250 });
            } else {
              // Left = Hard
              difficulty = 'hard';
              translateX.value = withTiming(-width * 1.5, { duration: 250 });
            }
          }
          
          // Call onAnswer immediately (don't wait for animation)
          handleAnswer(difficulty);
        } else {
          // Snap back
          translateX.value = withSpring(0);
          translateY.value = withSpring(0);
          
          // Reset overlay
          if (onSwipeChange) {
            runOnJS(onSwipeChange)(0, 0, true);
          }
        }
      }
    });

  const cardAnimatedStyle = useAnimatedStyle(() => {
    const transforms: any[] = [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ];

    if (isRevealed.value) {
      const rotation = interpolate(
        translateX.value,
        [-width / 2, 0, width / 2],
        [-15, 0, 15],
        Extrapolate.CLAMP
      );
      transforms.push({ rotate: `${rotation}deg` });
    }

    return {
      transform: transforms,
    };
  });

  const [displayText, setDisplayText] = React.useState(card.front);
  const hasSwapped = useSharedValue(false);

  React.useEffect(() => {
    // Reset when card changes
    setDisplayText(card.front);
    revealProgress.value = 0;
    hasSwapped.value = false;
  }, [card, revealProgress, hasSwapped]);

  // Watch for when to switch text
  useAnimatedReaction(
    () => revealProgress.value,
    (current, previous) => {
      // Switch to back when crossing 0.5 going forward
      if (current >= 0.5 && (previous === null || previous < 0.5) && !hasSwapped.value) {
        hasSwapped.value = true;
        runOnJS(setDisplayText)(card.back);
      }
      // Switch to front when crossing 0.5 going backward
      else if (current < 0.5 && previous !== null && previous >= 0.5 && hasSwapped.value) {
        hasSwapped.value = false;
        runOnJS(setDisplayText)(card.front);
      }
      // Reset at endpoints
      else if (current === 0) {
        hasSwapped.value = false;
      } else if (current === 1) {
        hasSwapped.value = true;
      }
    }
  );

  const cardTextStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      revealProgress.value,
      [0, 0.5, 1],
      [1, 0, 1],
      Extrapolate.CLAMP
    );
    
    return {
      opacity,
    };
  });

  const cardShadowStyle = useAnimatedStyle(() => {
    const baseOpacity = (sh.card as any)?.shadowOpacity ?? 0.25;
    const baseElevation = (sh.card as any)?.elevation ?? 8;
    return {
      shadowOpacity: baseOpacity * shadowProgress.value,
      elevation: baseElevation * shadowProgress.value,
    } as any;
  });

  const [swipeIcon, setSwipeIcon] = React.useState('✓');

  const iconAnimatedStyle = useAnimatedStyle(() => {
    if (!isRevealed.value) return { opacity: 0 };

    const absX = Math.abs(translateX.value);
    const absY = Math.abs(translateY.value);
    const totalDistance = absX + absY;
    
    if (totalDistance < 20) return { opacity: 0 }; // Hide icon on tiny movements
    
    // More visible icon opacity
    const opacity = Math.min(totalDistance / 120, 1);

    // Determine icon based on swipe direction
    let icon = '✓';
    if (absY > absX) {
      icon = translateY.value > 0 ? '↻' : '✓'; // Again or Good
    } else {
      icon = translateX.value > 0 ? '☆' : '!'; // Easy or Hard
    }
    
    if (totalDistance > 20) {
      runOnJS(setSwipeIcon)(icon);
    }

    return { opacity };
  });

  const combinedGesture = Gesture.Race(tapGesture, panGesture);

  return (
    <GestureDetector gesture={combinedGesture}>
      <Animated.View style={[styles.container, cardAnimatedStyle]}>
        {/* Single card with text that changes */}
        <View style={styles.cardContainer}>
          <Animated.View style={[styles.card, { backgroundColor: theme.colors.surface }, sh.card, cardShadowStyle]}>
            <Animated.Text style={[styles.cardText, { color: theme.colors.textPrimary }, cardTextStyle]}>
              {displayText}
            </Animated.Text>
          </Animated.View>
        </View>

        {/* Swipe direction icon - on top */}
        <Animated.View style={[styles.iconContainer, iconAnimatedStyle]} pointerEvents="none">
          <Text style={styles.icon}>{swipeIcon}</Text>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
  },
  cardContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: s.lg,
  },
  
  card: {
    width: '100%',
    height: '80%',
    borderRadius: r.lg,
    padding: s.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: {
    fontSize: 28,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 38,
  },
  iconContainer: {
    position: 'absolute',
    alignSelf: 'center',
    top: '45%',
  },
  icon: {
    fontSize: 80,
    color: 'white',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
});
