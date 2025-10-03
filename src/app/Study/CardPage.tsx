import React from 'react';
import { View, StyleSheet, Dimensions, Text, ScrollView } from 'react-native';
import Animated, { 
  useAnimatedStyle, 
  withTiming, 
  interpolate, 
  useSharedValue,
  runOnJS,
  withSpring,
  Extrapolate,
  useAnimatedReaction
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useTheme } from '../../design';
import { s } from '../../design/spacing';
import { r } from '../../design/radii';
import { sh } from '../../design/shadows';
import { Card } from '../../domain/models';
import { Difficulty } from '../../domain/srsTypes';
import { useHaptics } from '../../hooks/useHaptics';
import CardContentRenderer from '../../components/CardContentRendererV2';

const { height, width } = Dimensions.get('window');

const SWIPE_THRESHOLD = 100;

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
  const touchStartY = useSharedValue(0); // Track where finger started vertically
  
  // React state for revealed status (for rendering)
  const [revealed, setRevealed] = React.useState(false);

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
      runOnJS(setRevealed)(true);
      if (onReveal) {
        runOnJS(onReveal)();
      }
      revealProgress.value = withTiming(1, { duration: 300 });
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
    .maxDuration(250)
    .numberOfTaps(1)
    .onEnd(() => {
      'worklet';
      handleToggle();
    });
  
  // Two-finger scroll implementation
  const scrollY = useSharedValue(0);
  const contentHeight = useSharedValue(0);
  const containerHeight = height * 0.8 - s.md * 2; // Card height minus padding
  

  
  const scrollGesture = Gesture.Pan()
    .minPointers(2)
    .maxPointers(2)
    .onChange((event) => {
      'worklet';
      const maxScroll = Math.max(0, contentHeight.value - containerHeight);
      const newScrollY = scrollY.value - event.changeY;
      scrollY.value = Math.max(0, Math.min(newScrollY, maxScroll));
    });
  
  const scrollAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -scrollY.value }]
  }));

  // One-finger pan for rating swipes
  const panGesture = Gesture.Pan()
    .maxPointers(1)
    .onBegin((event) => {
      'worklet';
      // Store the Y position where the touch started (relative to card center)
      touchStartY.value = event.y - (height / 2);
    })
    .onUpdate((event) => {
      'worklet';
      // Only allow rating swipes when answer is fully visible
      if (isRevealed.value && revealProgress.value === 1) {
        // Tinder-style: translation follows finger exactly
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
        // Use velocity for more natural feel
        const absX = Math.abs(event.translationX);
        const absY = Math.abs(event.translationY);
        const velocityX = event.velocityX;
        const velocityY = event.velocityY;
        
        // Check if swipe was strong enough (distance OR velocity)
        const isStrongSwipe = absX > SWIPE_THRESHOLD || absY > SWIPE_THRESHOLD || 
                             Math.abs(velocityX) > 500 || Math.abs(velocityY) > 500;
        
        if (isStrongSwipe) {
          // Determine direction based on which axis has more movement
          let difficulty: Difficulty;
          
          if (absY > absX) {
            // Vertical swipe
            if (event.translationY > 0) {
              // Down = Again
              difficulty = 'again';
              translateY.value = withSpring(height * 1.5, { 
                velocity: velocityY,
                damping: 20,
                stiffness: 90
              });
            } else {
              // Up = Good
              difficulty = 'good';
              translateY.value = withSpring(-height * 1.5, { 
                velocity: velocityY,
                damping: 20,
                stiffness: 90
              });
            }
          } else {
            // Horizontal swipe
            if (event.translationX > 0) {
              // Right = Easy
              difficulty = 'easy';
              translateX.value = withSpring(width * 1.5, { 
                velocity: velocityX,
                damping: 20,
                stiffness: 90
              });
            } else {
              // Left = Hard
              difficulty = 'hard';
              translateX.value = withSpring(-width * 1.5, { 
                velocity: velocityX,
                damping: 20,
                stiffness: 90
              });
            }
          }
          
          // Call onAnswer immediately (don't wait for animation)
          handleAnswer(difficulty);
        } else {
          // Snap back with spring physics
          translateX.value = withSpring(0, {
            damping: 15,
            stiffness: 150
          });
          translateY.value = withSpring(0, {
            damping: 15,
            stiffness: 150
          });
          
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
      // Calculate rotation based on horizontal swipe AND vertical touch position
      // If you swipe from bottom, card rotates less (or opposite direction)
      // This creates natural physics like Tinder
      const baseRotation = interpolate(
        translateX.value,
        [-width / 2, 0, width / 2],
        [-15, 0, 15],
        Extrapolate.CLAMP
      );
      
      // Adjust rotation based on where finger started vertically
      // Touch at top = more rotation, touch at bottom = less/reverse rotation
      const verticalFactor = interpolate(
        touchStartY.value,
        [-height / 4, 0, height / 4],
        [1.5, 1, 0.5], // Top = more rotation, bottom = less rotation
        Extrapolate.CLAMP
      );
      
      const rotation = baseRotation * verticalFactor;
      transforms.push({ rotate: `${rotation}deg` });
    }

    return {
      transform: transforms,
    };
  });

  const [displayText, setDisplayText] = React.useState(card.front);
  const hasSwapped = useSharedValue(false);
  
  // Check if this is a cloze card (contains cloze deletions)
  const isClozeCard = card.front.includes('{{c');

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
      // For cloze cards, keep showing the same text (front) - the renderer handles reveal
      if (isClozeCard) {
        // Don't swap text for cloze cards
        return;
      }
      
      // For normal cards, switch between front and back
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

  const [swipeLabel, setSwipeLabel] = React.useState('GOOD');
  const [swipeColor, setSwipeColor] = React.useState('#10B981');

  const overlayAnimatedStyle = useAnimatedStyle(() => {
    if (!isRevealed.value) return { opacity: 0 };

    const absX = Math.abs(translateX.value);
    const absY = Math.abs(translateY.value);
    const totalDistance = absX + absY;
    
    if (totalDistance < 30) return { opacity: 0 };
    
    // Opacity based on swipe distance (like Tinder)
    const opacity = Math.min(totalDistance / 150, 1);

    // Determine label and color based on swipe direction
    let label = 'GOOD';
    let color = '#10B981'; // green
    
    if (absY > absX) {
      if (translateY.value > 0) {
        label = 'AGAIN';
        color = '#EF4444'; // red
      } else {
        label = 'GOOD';
        color = '#10B981'; // green
      }
    } else {
      if (translateX.value > 0) {
        label = 'EASY';
        color = '#3B82F6'; // blue
      } else {
        label = 'HARD';
        color = '#F59E0B'; // orange
      }
    }
    
    if (totalDistance > 30) {
      runOnJS(setSwipeLabel)(label);
      runOnJS(setSwipeColor)(color);
    }

    return { opacity };
  });
  
  // Position overlay based on swipe direction
  const overlayPositionStyle = useAnimatedStyle(() => {
    const absX = Math.abs(translateX.value);
    const absY = Math.abs(translateY.value);
    
    // Determine which direction is being swiped
    if (absY > absX) {
      // Vertical swipe
      if (translateY.value > 0) {
        // Swiping DOWN = AGAIN = show at TOP
        return {
          top: 60,
          left: 0,
          right: 0,
          alignItems: 'center',
        };
      } else {
        // Swiping UP = GOOD = show at BOTTOM
        return {
          top: 730,
          left: 0,
          right: 0,
          alignItems: 'center',
        };
      }
    } else {
      // Horizontal swipe
      if (translateX.value > 0) {
        // Swiping RIGHT = EASY = show at TOP LEFT
        return {
          top: 60,
          left: 20,
          right: 0,
          alignItems: 'flex-start',
        };
      } else {
        // Swiping LEFT = HARD = show at TOP RIGHT
        return {
          top: 60,
          left: 0,
          right: 20,
          alignItems: 'flex-end',
        };
      }
    }
  });

  // Simultaneous: allow two-finger scroll independently from tap/swipe
  const combinedGesture = Gesture.Simultaneous(
    scrollGesture,
    Gesture.Race(tapGesture, panGesture)
  );

  return (
    <GestureDetector gesture={combinedGesture}>
      <Animated.View style={[styles.container, cardAnimatedStyle]}>
        {/* Single card with text that changes */}
        <View style={styles.cardContainer}>
          <Animated.View style={[styles.card, { backgroundColor: theme.colors.surface }, sh.card, cardShadowStyle]}>
            <View style={styles.scrollContainer}>
              <Animated.View 
                style={[styles.scrollContent, scrollAnimatedStyle]}
                onLayout={(e) => {
                  contentHeight.value = e.nativeEvent.layout.height;
                }}
              >
                <CardContentRenderer 
                  html={isClozeCard && revealed ? `${displayText}<div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid rgba(128,128,128,0.2);">${card.back}</div>` : displayText}
                  revealed={revealed}
                  clozeIndex={0}
                  cardId={card.id}
                />
              </Animated.View>
            </View>
          </Animated.View>
        </View>

        {/* Tinder-style swipe overlay */}
        <Animated.View style={[styles.swipeOverlay, overlayPositionStyle, overlayAnimatedStyle]} pointerEvents="none">
          <View style={[styles.swipeLabelContainer, { borderColor: swipeColor }]}>
            <Text style={[styles.swipeLabel, { color: swipeColor }]}>{swipeLabel}</Text>
          </View>
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
    overflow: 'hidden',
  },
  scrollContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  scrollContent: {
    padding: s.md,
  },
  cardText: {
    fontSize: 28,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 38,
  },
  swipeOverlay: {
    position: 'absolute',
    // Position will be set dynamically by overlayPositionStyle
  },
  swipeLabelContainer: {
    borderWidth: 4,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 8,
    transform: [{ rotate: '-15deg' }],
  },
  swipeLabel: {
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: 2,
  },
});
