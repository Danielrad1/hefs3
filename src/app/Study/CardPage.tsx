import React, { useRef } from 'react';
import { View, StyleSheet, Dimensions, Text, ScrollView, Pressable, Modal } from 'react-native';
import Animated, { 
  useAnimatedStyle, 
  withTiming, 
  interpolate, 
  useSharedValue,
  runOnJS,
  withSpring,
  withSequence,
  Extrapolate,
  useAnimatedScrollHandler,
  Easing
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView, GestureType } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design';
import { ImageCache } from '../../utils/ImageCache';
import { s } from '../../design/spacing';
import { r } from '../../design/radii';
import { sh } from '../../design/shadows';
import { Card } from '../../domain/models';
import { Difficulty } from '../../domain/srsTypes';
import { useHaptics } from '../../hooks/useHaptics';
import CardContentRenderer from '../../components/CardContentRendererV2';
import { cardHintsService, CardHint } from '../../services/anki/CardHintsService';
import { MultiLevelHintDisplay } from '../../components/MultiLevelHintDisplay';
import { TipDisplay } from '../../components/TipDisplay';

const { height, width } = Dimensions.get('window');

const SWIPE_THRESHOLD = 150; // Increased threshold to prevent accidental ratings while scrolling

type CardPageProps = {
  card: Card;
  onAnswer: (difficulty: Difficulty) => void;
  onSwipeChange?: (translateX: number, translateY: number, isRevealed: boolean) => void;
  onReveal?: () => void;
  disabled?: boolean; // Disable gestures when card is in background
  hint?: CardHint | null; // AI-generated hint for this card
  onRequestEnableHints?: () => void; // Callback when user wants to enable hints
  aiHintsEnabled?: boolean; // Whether AI hints are enabled for this deck
  hintsLoading?: boolean; // Whether hints are currently loading
  onHintRevealed?: (depth: 1 | 2 | 3) => void; // Callback when user reveals a hint level
};

const CardPage = React.memo(function CardPage({ card, onAnswer, onSwipeChange, onReveal, disabled = false, hint, onRequestEnableHints, aiHintsEnabled = false, hintsLoading = false, onHintRevealed }: CardPageProps) {
  const theme = useTheme();
  const { selection, ratingEasy, ratingGood, ratingHard, ratingAgain } = useHaptics();
  const panRef = useRef<GestureType | undefined>(undefined);
  const scrollRef = useRef<Animated.ScrollView>(null);
  
  // Safe logging function to call from worklets
  const log = React.useCallback((tag: string, msg: string) => {
    console.log(`[CardPage ${tag}] ${msg}`);
  }, []);
  
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const isRevealed = useSharedValue(false);
  const revealProgress = useSharedValue(0);
  const touchStartY = useSharedValue(0); // Track where finger started vertically
  
  // Scroll tracking for edge-gated rating swipes
  const scrollY = useSharedValue(0);
  const contentH = useSharedValue(0);
  const viewportH = useSharedValue(0);
  const scrollEnabled = useSharedValue(true); // Track if content actually needs scrolling
  
  // Gesture-start gating: check if at bottom when gesture STARTS (not mid-gesture)
  const verticalRatingAllowed = useSharedValue(false);
  const gestureIsScroll = useSharedValue(false); // Lock gesture as scroll if it starts as vertical without permission
  const gestureIsHorizontal = useSharedValue(false); // Lock gesture as horizontal once detected
  const isScrolling = useSharedValue(false); // Track if ScrollView is actively handling this gesture
  const scrollYWhenPanStarted = useSharedValue(0); // Track scroll position when pan started
  const gestureStartTime = useSharedValue(0); // Track when gesture started for delayed feedback
  
  // React state for revealed status (for rendering)
  const [revealed, setRevealed] = React.useState(false);
  const [showHintModal, setShowHintModal] = React.useState(false);
  const [showTipModal, setShowTipModal] = React.useState(false);

  // Reset state when card changes (synchronize with card transitions)
  React.useEffect(() => {
    // Reset all state immediately when card changes
    setRevealed(false);
    setShowHintModal(false);
    setShowTipModal(false);
    isRevealed.value = false;
    revealProgress.value = 0;
    translateX.value = 0;
    translateY.value = 0;
  }, [card.id]);

  // Removed shadow animation - static shadows for better performance

  const handleReveal = () => {
    'worklet';
    if (!isRevealed.value) {
      isRevealed.value = true;
      runOnJS(setRevealed)(true);
      if (onReveal) {
        runOnJS(onReveal)();
      }
      // Cloze cards: instant reveal (no crossfade needed)
      // Normal cards: smooth crossfade
      const isCloze = card.front.includes('{{c');
      revealProgress.value = withTiming(1, { 
        duration: isCloze ? 200 : 350,
        easing: isCloze ? Easing.out(Easing.ease) : Easing.out(Easing.cubic),
      });
    }
  };

  const handleToggle = () => {
    'worklet';
    // Toggle between question and answer
    const isCloze = card.front.includes('{{c');
    
    if (revealProgress.value === 0) {
      // Show answer - instant for cloze, smooth for normal
      revealProgress.value = withTiming(1, {
        duration: isCloze ? 200 : 350,
        easing: isCloze ? Easing.out(Easing.ease) : Easing.out(Easing.cubic),
      });
      runOnJS(selection)();
      handleReveal();
    } else {
      // Hide answer - go back to question
      revealProgress.value = withTiming(0, {
        duration: isCloze ? 200 : 350,
        easing: isCloze ? Easing.out(Easing.ease) : Easing.out(Easing.cubic),
      });
      runOnJS(selection)();
      // Reset revealed state for cloze cards
      isRevealed.value = false;
      runOnJS(setRevealed)(false);
    }
  };

  const handleAnswer = (difficulty: Difficulty) => {
    'worklet';
    runOnJS(onAnswer)(difficulty);
  };

  // Scroll handler for tracking scroll position
  const onScroll = useAnimatedScrollHandler({
    onBeginDrag: (e) => {
      'worklet';
      isScrolling.value = true;
      runOnJS(log)('SCROLL_BEGIN', `y=${e.contentOffset.y.toFixed(0)}`);
    },
    onScroll: (e) => {
      'worklet';
      scrollY.value = e.contentOffset.y;
      contentH.value = e.contentSize.height;
      viewportH.value = e.layoutMeasurement.height;
      
      // CRITICAL: Disable scrolling if content fits in viewport
      const contentFits = (contentH.value - viewportH.value) <= 5;
      scrollEnabled.value = !contentFits;
      
      if (contentFits) {
        runOnJS(log)('SCROLL_DISABLED', `content=${contentH.value.toFixed(0)} viewport=${viewportH.value.toFixed(0)}`);
      }
    },
    onEndDrag: (e) => {
      'worklet';
      isScrolling.value = false;
      runOnJS(log)('SCROLL_END', `y=${e.contentOffset.y.toFixed(0)}`);
    },
  });
  
  // Native scroll gesture for simultaneity
  const scrollGesture = Gesture.Native();
  
  // Tap to toggle between question/answer, pan to rate
  const tapGesture = Gesture.Tap()
    .maxDuration(250)
    .numberOfTaps(1)
    .onEnd(() => {
      'worklet';
      handleToggle();
    });

  // One-finger pan for rating swipes  
  const panGesture = Gesture.Pan()
    .withRef(panRef)
    .maxPointers(1)
    .simultaneousWithExternalGesture(scrollGesture)
    .minDistance(4)
    .enabled(!disabled)
    .onBegin((event) => {
      'worklet';
      touchStartY.value = event.y - (height / 2);
      
      // Lock permissions at gesture BEGIN
      const EPS = 12;
      const atTop = scrollY.value <= EPS; // At top (for Again - swipe down)
      const atBottom = (contentH.value - viewportH.value - scrollY.value) <= EPS; // At bottom (for Easy - swipe up)
      const fits = (contentH.value - viewportH.value) <= EPS; // Content fits without scrolling
      
      // Allow vertical rating at EITHER edge or when content fits
      // atTop = can swipe down for Again
      // atBottom = can swipe up for Easy
      verticalRatingAllowed.value = fits || atTop || atBottom;
      gestureIsScroll.value = false; // Will be determined in onUpdate based on direction
      gestureIsHorizontal.value = false; // Will be determined in onUpdate based on direction
      scrollYWhenPanStarted.value = scrollY.value; // Remember where we started
      gestureStartTime.value = Date.now(); // Track when gesture started for delayed feedback
      
      const msg = `scrollY=${scrollY.value.toFixed(0)} atTop=${atTop} atBottom=${atBottom} fits=${fits} vertAllowed=${verticalRatingAllowed.value} revealed=${isRevealed.value}`;
      runOnJS(log)('BEGIN', msg);
    })
    .onUpdate((event) => {
      'worklet';
      // Only allow rating swipes when answer is fully visible
      if (!isRevealed.value || revealProgress.value !== 1) {
        runOnJS(log)('UPDATE_BLOCKED', `revealed=${isRevealed.value} progress=${revealProgress.value}`);
        return;
      }
      
      const absX = Math.abs(event.translationX);
      const absY = Math.abs(event.translationY);
      const totalMovement = absX + absY;
      
      // Debug: Log first update
      if (totalMovement > 5 && totalMovement < 15) {
        const msg = `UPDATE movement=${totalMovement.toFixed(0)} isScrolling=${isScrolling.value}`;
        runOnJS(log)('UPDATE', msg);
      }
      
      // Determine gesture direction once we have meaningful movement
      const isVertical = absY > absX;
      const isHorizontal = absX > absY;
      
      // Lock gesture direction once determined (>10px movement)
      if (totalMovement > 10) {
        if (!gestureIsHorizontal.value && !gestureIsScroll.value && isHorizontal) {
          gestureIsHorizontal.value = true;
          runOnJS(log)('LOCKED_HORIZONTAL', `absX=${absX.toFixed(0)}`);
        }
      }
      
      // If actively scrolling, lock the gesture completely (no card movement at all)
      // BUT: Be smart about direction - don't lock if gesture makes no sense as scroll
      const scrollChanged = Math.abs(scrollY.value - scrollYWhenPanStarted.value) > 5;
      if (!gestureIsScroll.value && !gestureIsHorizontal.value && isScrolling.value && scrollChanged) {
        // Check if scroll direction makes sense
        const swipeDirection = event.translationY > 0 ? 'down' : 'up';
        const atTop = scrollYWhenPanStarted.value <= 12;
        const atBottom = verticalRatingAllowed.value && !atTop;
        
        // Don't lock if: at top swiping down OR at bottom swiping up (these are likely ratings)
        const isImpossibleScroll = (atTop && swipeDirection === 'down') || (atBottom && swipeDirection === 'up');
        
        if (!isImpossibleScroll) {
          gestureIsScroll.value = true;
          const msg = `Scroll active ${Math.abs(scrollY.value - scrollYWhenPanStarted.value).toFixed(0)}px`;
          runOnJS(log)('LOCKED_SCROLLING', msg);
        } else {
          runOnJS(log)('SCROLL_IGNORED', `${swipeDirection} at ${atTop ? 'top' : 'bottom'}`);
        }
      }
      
      // ONLY lock vertical gestures when scrolling
      if (!gestureIsScroll.value && !gestureIsHorizontal.value && isVertical) {
        // Lock if vertical movement without permission (not at bottom)
        if (totalMovement > 10 && !verticalRatingAllowed.value) {
          gestureIsScroll.value = true;
          const msg = `Vertical without permission absY=${absY.toFixed(0)}`;
          runOnJS(log)('LOCKED_SCROLL', msg);
        }
      }
      
      // If locked as scroll (actively scrolling), freeze card completely
      if (gestureIsScroll.value) {
        translateX.value = 0;
        translateY.value = 0;
        // Don't trigger swipe change callback - prevents colored lights flash
      } else if (gestureIsHorizontal.value) {
        // Locked as horizontal - only allow horizontal movement
        translateX.value = event.translationX;
        translateY.value = 0;
        
        // Instant color feedback for fast swipes
        if (onSwipeChange) {
          runOnJS(onSwipeChange)(translateX.value, translateY.value, true);
        }
      } else {
        // Not locked yet - allow both directions based on permissions
        translateX.value = event.translationX;
        translateY.value = verticalRatingAllowed.value ? event.translationY : 0;
        
        // Instant color feedback for fast swipes
        if (onSwipeChange) {
          runOnJS(onSwipeChange)(translateX.value, translateY.value, true);
        }
      }
    })
    .onEnd((event) => {
      const totalDist = Math.abs(event.translationX) + Math.abs(event.translationY);
      runOnJS(log)('END_CALLED', `revealed=${isRevealed.value} progress=${revealProgress.value} totalDist=${totalDist.toFixed(0)}`);
      
      if (isRevealed.value && revealProgress.value === 1) {
        // Use event translation to determine TRUE gesture direction (before we modified it)
        const eventAbsX = Math.abs(event.translationX);
        const eventAbsY = Math.abs(event.translationY);
        const isHorizontalGesture = eventAbsX >= eventAbsY;
        
        const endMsg = `isScroll=${gestureIsScroll.value} horiz=${isHorizontalGesture} x=${translateX.value.toFixed(0)} y=${translateY.value.toFixed(0)}`;
        runOnJS(log)('END', endMsg);
        
        // If vertical gesture was locked as scroll, block it
        // But horizontal gestures can still rate (user may have scrolled then swiped horizontally)
        if (gestureIsScroll.value && !isHorizontalGesture) {
          runOnJS(log)('BLOCKED', 'Vertical scroll gesture');
          translateX.value = withSpring(0, { damping: 15, stiffness: 150 });
          translateY.value = withSpring(0, { damping: 15, stiffness: 150 });
          if (onSwipeChange) runOnJS(onSwipeChange)(0, 0, true);
          return; // Exit early - this was a scroll, not a rating
        }
        
        // For horizontal gestures, use event translation (may have been zeroed during scroll)
        // For non-locked gestures, use animated values
        const endX = isHorizontalGesture && gestureIsScroll.value ? event.translationX : translateX.value;
        const endY = isHorizontalGesture && gestureIsScroll.value ? event.translationY : translateY.value;
        
        const absX = Math.abs(endX);
        const absY = Math.abs(endY);
        const isHorizontalSwipe = absX >= absY;
        
        // Pure distance-based rating (no velocity)
        const isStrongSwipe = absX > SWIPE_THRESHOLD || absY > SWIPE_THRESHOLD;
        
        // Horizontal: always allowed, Vertical: only if allowed at gesture start
        if (isStrongSwipe && (isHorizontalSwipe || verticalRatingAllowed.value)) {
          const dir = isHorizontalSwipe ? (endX > 0 ? 'good' : 'hard') : (endY > 0 ? 'again' : 'easy');
          const rateMsg = `dir=${dir} horiz=${isHorizontalSwipe} x=${endX.toFixed(0)} y=${endY.toFixed(0)}`;
          runOnJS(log)('RATING', rateMsg);
          
          let difficulty: Difficulty;

          if (!isHorizontalSwipe) {
            if (endY > 0) {
              difficulty = 'again';
              runOnJS(ratingAgain)();
              
              translateX.value = 0;
              translateY.value = withSpring(height * 1.5, {
                velocity: event.velocityY, damping: 15, stiffness: 120
              });
            } else {
              difficulty = 'easy';
              runOnJS(ratingEasy)();
              
              translateX.value = 0;
              translateY.value = withSpring(-height * 1.5, {
                velocity: event.velocityY, damping: 15, stiffness: 120
              });
            }
          } else {
            if (endX > 0) {
              difficulty = 'good';
              runOnJS(ratingGood)();
              
              translateY.value = 0;
              translateX.value = withSpring(width * 1.5, {
                velocity: event.velocityX, damping: 15, stiffness: 120
              });
            } else {
              difficulty = 'hard';
              runOnJS(ratingHard)();
              
              translateY.value = 0;
              translateX.value = withSpring(-width * 1.5, {
                velocity: event.velocityX, damping: 15, stiffness: 120
              });
            }
          }
          
          handleAnswer(difficulty);
        } else {
          translateX.value = withSpring(0, { damping: 15, stiffness: 150 });
          translateY.value = withSpring(0, { damping: 15, stiffness: 150 });
          if (onSwipeChange) runOnJS(onSwipeChange)(0, 0, true);
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

  // Check if this is a cloze card (contains cloze deletions)
  const isClozeCard = card.front.includes('{{c');

  // Memoize HTML strings to prevent re-processing and maintain stable references
  const frontHtml = React.useMemo(() => card.front, [card.id]);
  const backHtml = React.useMemo(() => card.back, [card.id]);
  const clozeBackHtml = React.useMemo(() => 
    `${card.front}<hr style="margin: 24px 0; border: none; border-top: 2px solid rgba(128,128,128,0.25);" /><div style="margin-top: 16px;">${card.back}</div>`,
    [card.id, card.front, card.back]
  );

  // Track previous card ID to detect actual card changes vs position changes
  const prevCardIdRef = React.useRef(card.id);
  
  React.useLayoutEffect(() => {
    const isNewCard = prevCardIdRef.current !== card.id;
    prevCardIdRef.current = card.id;
    
    // Only reset state for NEW cards, not when same card changes position
    if (isNewCard) {
      translateX.value = 0;
      translateY.value = 0;
      touchStartY.value = 0;
      revealProgress.value = 0;
      isRevealed.value = false;
      setRevealed(false);
      setShowHintModal(false);
      setShowTipModal(false);
      verticalRatingAllowed.value = false;
      gestureIsScroll.value = false;
      
      // Reset scroll position to top
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }
  }, [card.id]); // Only depend on card.id for clean resets

  // Smooth reveal - no flash for cloze cards
  const frontOpacity = useAnimatedStyle(() => {
    // For cloze cards, don't crossfade - just hide front instantly at midpoint
    // For normal cards, smooth crossfade
    const opacity = isClozeCard 
      ? interpolate(revealProgress.value, [0, 0.01, 1], [1, 0, 0], Extrapolate.CLAMP)
      : interpolate(revealProgress.value, [0, 0.5, 1], [1, 0, 0], Extrapolate.CLAMP);
    
    return { 
      opacity: opacity,
    };
  });
  
  const backOpacity = useAnimatedStyle(() => {
    // For cloze cards, show back immediately to avoid flash
    // For normal cards, smooth crossfade
    const opacity = isClozeCard
      ? interpolate(revealProgress.value, [0, 0.01, 1], [0, 1, 1], Extrapolate.CLAMP)
      : interpolate(revealProgress.value, [0, 0.5, 1], [0, 0, 1], Extrapolate.CLAMP);
    
    return { 
      opacity: opacity,
    };
  });

  // Static shadow - always visible (no animation, no prop changes = no flicker)

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
        label = 'EASY';
        color = '#3B82F6'; // blue
      }
    } else {
      if (translateX.value > 0) {
        label = 'GOOD';
        color = '#10B981'; // green
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
        // Swiping RIGHT = GOOD = show at TOP LEFT
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

  // Gesture composition - pan simultaneous with scroll, but tap/pan exclusive
  const ratingGesture = Gesture.Race(tapGesture, panGesture);
  const composedGesture = Gesture.Simultaneous(scrollGesture, ratingGesture);

  return (
    <View style={styles.container}>
      {/* Top area - non-interactive, contains hint button (outside animation) */}
      {!disabled && (
        <View style={styles.topArea}>
          {!revealed && (
            <Pressable 
              style={({ pressed }) => [
                styles.floatingButton, 
                { 
                  backgroundColor: 'rgba(139, 92, 246, 0.15)',
                  opacity: pressed ? 0.7 : 1,
                  transform: [{ scale: pressed ? 0.95 : 1 }],
                }
              ]}
              onPress={() => {
                selection();
                if (hint) {
                  setShowHintModal(true);
                } else if (!aiHintsEnabled && !hintsLoading && onRequestEnableHints) {
                  // Only show enable prompt if hints are disabled and not loading
                  onRequestEnableHints();
                }
              }}
            >
              <Ionicons 
                name="bulb-outline" 
                size={24} 
                color="#8B5CF6" 
              />
            </Pressable>
          )}
          {revealed && (
            <Pressable 
              style={({ pressed }) => [
                styles.floatingButton, 
                { 
                  backgroundColor: 'rgba(236, 72, 153, 0.15)',
                  opacity: pressed ? 0.7 : 1,
                  transform: [{ scale: pressed ? 0.95 : 1 }],
                }
              ]}
              onPress={() => {
                selection();
                if (hint) {
                  setShowTipModal(true);
                } else if (!aiHintsEnabled && !hintsLoading && onRequestEnableHints) {
                  // Only show enable prompt if hints are disabled and not loading
                  onRequestEnableHints();
                }
              }}
            >
              <Ionicons 
                name="sparkles" 
                size={24} 
                color="#EC4899" 
              />
            </Pressable>
          )}
        </View>
      )}

      {/* Card area - interactive with gestures */}
      <GestureDetector gesture={composedGesture}>
        <Animated.View style={[styles.cardArea, cardAnimatedStyle]}>

        {/* Dual cards with crossfade - no content swapping */}
        <View style={styles.cardContainer}>
          <Animated.View style={[styles.card, { backgroundColor: theme.colors.surface }, sh.card]}>
            <Animated.ScrollView
              ref={scrollRef}
              onLayout={(e) => { 
                viewportH.value = e.nativeEvent.layout.height;
              }}
              onScroll={onScroll}
              scrollEventThrottle={16}
              bounces={false}
              overScrollMode="never"
              removeClippedSubviews={false}
              scrollEnabled={scrollEnabled.value}
              contentContainerStyle={styles.scrollContent}
            >
                {/* Spacer to establish scroll height */}
                <View style={{ opacity: 0, pointerEvents: 'none' }}>
                  <CardContentRenderer
                    key={`spacer-${card.id}`}
                    html={isClozeCard ? clozeBackHtml : backHtml}
                    revealed={true}
                    clozeIndex={0}
                    cardId={card.id}
                  />
                </View>
                
                {/* Front view - always rendered */}
                <Animated.View 
                  style={[frontOpacity, { position: 'absolute', top: 40, left: 24, right: 24 }]}
                  pointerEvents={revealed ? 'none' : 'auto'}
                >
                  <CardContentRenderer
                    key={`front-${card.id}`}
                    html={frontHtml}
                    revealed={false}
                    clozeIndex={0}
                    cardId={card.id}
                  />
                </Animated.View>
                
                {/* Back view - always rendered for instant flip */}
                <Animated.View 
                  style={[backOpacity, { position: 'absolute', top: 40, left: 24, right: 24 }]}
                  pointerEvents={revealed ? 'auto' : 'none'}
                >
                  <CardContentRenderer
                    key={`back-${card.id}`}
                    html={isClozeCard ? clozeBackHtml : backHtml}
                    revealed={true}
                    clozeIndex={0}
                    cardId={card.id}
                  />
                </Animated.View>
            </Animated.ScrollView>
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

      {/* Hint Modal - Bottom Sheet */}
      <Modal
        visible={showHintModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowHintModal(false)}
      >
        <View style={styles.bottomModalOverlay}>
          <Pressable 
            style={StyleSheet.absoluteFill}
            onPress={() => setShowHintModal(false)}
          />
          <View style={styles.bottomModalContent}>
            {hint && hint.hintL1 && hint.hintL2 && hint.hintL3 ? (
              <MultiLevelHintDisplay
                hintL1={hint.hintL1}
                hintL2={hint.hintL2}
                hintL3={hint.hintL3}
                onClose={() => setShowHintModal(false)}
                onHintRevealed={onHintRevealed}
              />
            ) : (
              <View style={[styles.noHintCard, { backgroundColor: theme.colors.surface }]}>
                <Ionicons name="bulb-outline" size={48} color={theme.colors.textSecondary} />
                <Text style={[styles.noHintTitle, { color: theme.colors.textPrimary }]}>
                  No hints available
                </Text>
                <Text style={[styles.noHintText, { color: theme.colors.textSecondary }]}>
                  Generate AI hints for this deck first.
                </Text>
                <Pressable 
                  onPress={() => setShowHintModal(false)}
                  style={[styles.noHintButton, { backgroundColor: theme.colors.accent }]}
                >
                  <Text style={styles.noHintButtonText}>Close</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Tip Modal - Bottom Sheet (No Dark Overlay) */}
      <Modal
        visible={showTipModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTipModal(false)}
      >
        <View style={styles.tipModalOverlay}>
          <Pressable 
            style={StyleSheet.absoluteFill}
            onPress={() => setShowTipModal(false)}
          />
          <View style={styles.tipModalContent}>
            {hint && hint.tip ? (
              <TipDisplay 
                tip={hint.tip} 
                confusableContrast={hint.confusableContrast}
                onClose={() => setShowTipModal(false)}
              />
            ) : (
              <View style={{ padding: s.xl }}>
                <Text style={[styles.modalTitle, { color: theme.colors.textPrimary }]}>
                  No tip available
                </Text>
                <Text style={[styles.modalText, { color: theme.colors.textSecondary, marginTop: s.md }]}>
                  Generate hints for this card first.
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}, (prevProps, nextProps) => {
  // Memo returns TRUE to SKIP re-render, FALSE to re-render
  // Re-render if card ID OR disabled state changes (gestures need to update)
  const cardIdSame = prevProps.card.id === nextProps.card.id;
  const disabledSame = prevProps.disabled === nextProps.disabled;
  const shouldSkip = cardIdSame && disabledSame;
  
  return shouldSkip;
});

export default CardPage;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    backgroundColor: 'transparent',
  },
  topArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: height * 0.125,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingRight: s.lg + 4,
    paddingTop: 8,
    zIndex: 1000,
  },
  cardArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  floatingButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
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
    height: '75%',
    borderRadius: r.lg,
    overflow: 'hidden',
  },
  contentContainer: {
    flex: 1,
    padding: s.lg,
  },
  scrollContent: {
    paddingTop: 40,
    paddingBottom: 40,
    paddingHorizontal: 24,
    // Removed minHeight - let content determine scroll need naturally
    flexGrow: 1,
  },
  cardText: {
    fontSize: 28,
    fontWeight: '500',
    textAlign: 'center',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: s.xl,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: r.lg,
    padding: s.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  bottomModalOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
  },
  bottomModalContent: {
    width: '100%',
  },
  tipModalOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
  },
  tipModalContent: {
    width: '100%',
    maxHeight: '70%',
  },
  noHintCard: {
    width: '100%',
    padding: s.xl * 2,
    borderRadius: r.xl,
    alignItems: 'center',
    gap: s.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 12,
  },
  noHintTitle: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  noHintText: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  noHintButton: {
    marginTop: s.md,
    paddingHorizontal: s.xl * 2,
    paddingVertical: s.lg,
    borderRadius: r.lg,
  },
  noHintButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0A0A0B',
  },
  modernModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'flex-end',
  },
  modernModalContent: {
    width: '100%',
    borderTopLeftRadius: r.xl,
    borderTopRightRadius: r.xl,
    padding: s.xl,
    paddingBottom: s.xl + 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.md,
    marginBottom: s.lg,
  },
  modalTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
  },
  modalText: {
    fontSize: 16,
    lineHeight: 24,
  },
  closeModalButton: {
    marginTop: s.xl,
    padding: s.lg,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderRadius: r.md,
    alignItems: 'center',
  },
  closeModalText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#8B5CF6',
  },
});
