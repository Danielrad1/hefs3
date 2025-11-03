import React, { useRef } from 'react';
import { View, StyleSheet, Dimensions, Text, ScrollView, Pressable, Modal, InteractionManager } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { db } from '../../services/anki/InMemoryDb';
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
  Easing,
  SharedValue
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
  translateXShared?: SharedValue<number>; // Expose translation for parent worklet computations
  translateYShared?: SharedValue<number>; // Expose translation for parent worklet computations
  isRevealedShared?: SharedValue<boolean>; // Expose revealed state for parent worklet computations
  onReveal?: () => void;
  disabled?: boolean; // Disable gestures when card is in background
  hint?: CardHint | null; // AI-generated hint for this card
  onRequestEnableHints?: () => void; // Callback when user wants to enable hints
  aiHintsEnabled?: boolean; // Whether AI hints are enabled for this deck
  hintsLoading?: boolean; // Whether hints are currently loading
  onHintRevealed?: (depth: 1 | 2 | 3) => void; // Callback when user reveals a hint level
};

const CardPage = React.memo(function CardPage({ card, onAnswer, translateXShared, translateYShared, isRevealedShared, onReveal, disabled = false, hint, onRequestEnableHints, aiHintsEnabled = false, hintsLoading = false, onHintRevealed }: CardPageProps) {
  const theme = useTheme();
  const { selection, ratingEasy, ratingGood, ratingHard, ratingAgain } = useHaptics();
  const navigation = useNavigation<any>();
  const panRef = useRef<GestureType | undefined>(undefined);
  const scrollRef = useRef<Animated.ScrollView>(null);
  
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const isRevealed = useSharedValue(false);
  const revealProgress = useSharedValue(0);
  const touchStartY = useSharedValue(0); // Track where finger started vertically
  
  // Scroll tracking for edge-gated rating swipes
  const scrollY = useSharedValue(0);
  const contentH = useSharedValue(0);
  const viewportH = useSharedValue(0);
  const scrollEnabled = useSharedValue(true); // Track if content actually needs scrolling (worklet-side)
  
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
  const [isScrollEnabled, setIsScrollEnabled] = React.useState(true);

  const syncScrollEnabled = React.useCallback((enabled: boolean) => {
    setIsScrollEnabled((prev) => (prev === enabled ? prev : enabled));
  }, []);

  // Callback for batched reveal state updates (defined outside worklet for runOnJS)
  const updateRevealedState = React.useCallback(() => {
    setRevealed(true);
    if (onReveal) onReveal();
  }, [onReveal]);

  // Pre-warm animation worklets on mount to prevent first-flip jank
  React.useEffect(() => {
    // Trigger multiple tiny animations to compile all worklets (imperceptible to user)
    // This prevents the first flip from being slow
    revealProgress.value = withTiming(0.001, { duration: 1 });
    translateX.value = withSpring(0.001, { damping: 15, stiffness: 150 });
    translateY.value = withSpring(0.001, { damping: 15, stiffness: 150 });
    
    // Reset after compilation
    setTimeout(() => {
      revealProgress.value = 0;
      translateX.value = 0;
      translateY.value = 0;
    }, 10);
  }, []);

  // Reset state when card changes (synchronize with card transitions)
  React.useEffect(() => {
    // Reset all state immediately when card changes
    setRevealed(false);
    setShowHintModal(false);
    setShowTipModal(false);
    isRevealed.value = false;
    if (isRevealedShared) isRevealedShared.value = false;
    revealProgress.value = 0;
    translateX.value = 0;
    translateY.value = 0;
    if (translateXShared) translateXShared.value = 0;
    if (translateYShared) translateYShared.value = 0;
  }, [card.id]);

  // Removed shadow animation - static shadows for better performance

  const handleReveal = () => {
    'worklet';
    if (!isRevealed.value) {
      isRevealed.value = true;
      // Sync to parent shared value for worklet access
      if (isRevealedShared) {
        isRevealedShared.value = true;
      }
      // Batch state updates together in a single runOnJS call
      runOnJS(updateRevealedState)();
      // Cloze cards and IO cards: instant reveal (no crossfade needed to prevent image flash)
      // Normal cards: smooth crossfade
      const isCloze = card.front.includes('{{c');
      const isImageOcclusion = card.front.includes('<io-occlude') || card.back.includes('<io-occlude');
      // Use spring for smoother initial animation (avoids timing easing calculations)
      revealProgress.value = (isCloze || isImageOcclusion)
        ? withTiming(1, { duration: 1 }) // 1ms = truly instant, no flash
        : withSpring(1, { damping: 20, stiffness: 180, mass: 0.5 });
    }
  };

  const handleToggle = () => {
    'worklet';
    // Toggle between question and answer
    const isCloze = card.front.includes('{{c');
    const isImageOcclusion = card.front.includes('<io-occlude') || card.back.includes('<io-occlude');
    
    if (revealProgress.value === 0) {
      // Show answer - instant for cloze/IO, smooth spring for normal
      revealProgress.value = (isCloze || isImageOcclusion)
        ? withTiming(1, { duration: 1 }) // 1ms = truly instant, no flash
        : withSpring(1, { damping: 20, stiffness: 180, mass: 0.5 });
      runOnJS(selection)();
      handleReveal();
    } else {
      // Hide answer - go back to question
      revealProgress.value = (isCloze || isImageOcclusion)
        ? withTiming(0, { duration: 1 }) // 1ms = truly instant, no flash
        : withSpring(0, { damping: 20, stiffness: 180, mass: 0.5 });
      runOnJS(selection)();
      // Reset revealed state for cloze/IO cards
      isRevealed.value = false;
      if (isRevealedShared) {
        isRevealedShared.value = false;
      }
      runOnJS(setRevealed)(false);
    }
  };

  const handleAnswer = (difficulty: Difficulty) => {
    'worklet';
    runOnJS(onAnswer)(difficulty);
  };

  // Programmatic rating - EXACT COPY of swipe gesture animation
  const triggerRating = React.useCallback((difficulty: Difficulty) => {
    'worklet';
    // Guard: only allow rating when revealed
    if (!isRevealed.value || revealProgress.value !== 1) return;
    
    // Simulate touch position for rotation pivot (buttons are at bottom)
    // touchStartY affects rotation: positive = touch below center = less rotation
    touchStartY.value = height / 4; // Bottom of screen touch
    
    // Hide buttons instantly (but keep isRevealed true for overlay)
    runOnJS(setRevealed)(false);
    
    // EXACT COPY of swipe onEnd animation code
    if (difficulty === 'again') {
      runOnJS(ratingAgain)();
      translateX.value = 0;
      translateY.value = withSpring(height * 1.5, {
        velocity: 800, damping: 15, stiffness: 120
      });
      // Sync parent shared values
      if (translateXShared) translateXShared.value = translateX.value;
      if (translateYShared) translateYShared.value = translateY.value;
    } else if (difficulty === 'hard') {
      runOnJS(ratingHard)();
      translateY.value = 0;
      translateX.value = withSpring(-width * 1.5, {
        velocity: 800, damping: 15, stiffness: 120
      });
      // Sync parent shared values
      if (translateXShared) translateXShared.value = translateX.value;
      if (translateYShared) translateYShared.value = translateY.value;
    } else if (difficulty === 'good') {
      runOnJS(ratingGood)();
      translateY.value = 0;
      translateX.value = withSpring(width * 1.5, {
        velocity: 800, damping: 15, stiffness: 120
      });
      // Sync parent shared values
      if (translateXShared) translateXShared.value = translateX.value;
      if (translateYShared) translateYShared.value = translateY.value;
    } else if (difficulty === 'easy') {
      runOnJS(ratingEasy)();
      translateX.value = 0;
      translateY.value = withSpring(-height * 1.5, {
        velocity: 800, damping: 15, stiffness: 120
      });
      // Sync parent shared values
      if (translateXShared) translateXShared.value = translateX.value;
      if (translateYShared) translateYShared.value = translateY.value;
    }
    
    // Call onAnswer (StudyScreen delays scheduler update for animation)
    runOnJS(onAnswer)(difficulty);
  }, [onAnswer, ratingAgain, ratingHard, ratingGood, ratingEasy]);

  // Edit handler to jump to Note Editor
  const handleEdit = React.useCallback(() => {
    const ankiCard = db.getCard(card.id);
    const noteId = ankiCard?.nid;
    if (!noteId) return;
    navigation.navigate('Decks', { screen: 'NoteEditor', params: { noteId, returnToStudy: true } });
  }, [card.id, navigation]);

  // Scroll handler for tracking scroll position
  const onScroll = useAnimatedScrollHandler({
    onBeginDrag: (e) => {
      'worklet';
      isScrolling.value = true;
    },
    onScroll: (e) => {
      'worklet';
      scrollY.value = e.contentOffset.y;
      contentH.value = e.contentSize.height;
      viewportH.value = e.layoutMeasurement.height;
      
      // CRITICAL: Disable scrolling if content fits in viewport
      const contentFits = (contentH.value - viewportH.value) <= 5;
      const nextEnabled = !contentFits;
      
      if (scrollEnabled.value !== nextEnabled) {
        scrollEnabled.value = nextEnabled;
        runOnJS(syncScrollEnabled)(nextEnabled);
      }
      
    },
    onEndDrag: (e) => {
      'worklet';
      isScrolling.value = false;
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
      
    })
    .onUpdate((event) => {
      'worklet';
      // Only allow rating swipes when answer is fully visible
      if (!isRevealed.value || revealProgress.value !== 1) {
        return;
      }
      
      const absX = Math.abs(event.translationX);
      const absY = Math.abs(event.translationY);
      const totalMovement = absX + absY;
      
      // Determine gesture direction once we have meaningful movement
      const isVertical = absY > absX;
      const isHorizontal = absX > absY;
      
      // Lock gesture direction once determined (>10px movement)
      if (totalMovement > 10) {
        if (!gestureIsHorizontal.value && !gestureIsScroll.value && isHorizontal) {
          gestureIsHorizontal.value = true;
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
        }
      }
      
      // ONLY lock vertical gestures when scrolling
      if (!gestureIsScroll.value && !gestureIsHorizontal.value && isVertical) {
        // Lock if vertical movement without permission (not at bottom)
        if (totalMovement > 10 && !verticalRatingAllowed.value) {
          gestureIsScroll.value = true;
        }
      }
      
      // If locked as scroll (actively scrolling), freeze card completely
      if (gestureIsScroll.value) {
        translateX.value = 0;
        translateY.value = 0;
        // Sync to parent shared values for worklet overlay computation
        if (translateXShared) translateXShared.value = 0;
        if (translateYShared) translateYShared.value = 0;
      } else if (gestureIsHorizontal.value) {
        // Locked as horizontal - only allow horizontal movement
        translateX.value = event.translationX;
        translateY.value = 0;
        // Sync to parent shared values for worklet overlay computation
        if (translateXShared) translateXShared.value = event.translationX;
        if (translateYShared) translateYShared.value = 0;
      } else {
        // Not locked yet - allow both directions based on permissions
        translateX.value = event.translationX;
        translateY.value = verticalRatingAllowed.value ? event.translationY : 0;
        // Sync to parent shared values for worklet overlay computation
        if (translateXShared) translateXShared.value = event.translationX;
        if (translateYShared) translateYShared.value = verticalRatingAllowed.value ? event.translationY : 0;
      }
    })
    .onEnd((event) => {
      if (isRevealed.value && revealProgress.value === 1) {
        // Use event translation to determine TRUE gesture direction (before we modified it)
        const eventAbsX = Math.abs(event.translationX);
        const eventAbsY = Math.abs(event.translationY);
        const isHorizontalGesture = eventAbsX >= eventAbsY;
        
        // If vertical gesture was locked as scroll, block it
        // But horizontal gestures can still rate (user may have scrolled then swiped horizontally)
        if (gestureIsScroll.value && !isHorizontalGesture) {
          translateX.value = withSpring(0, { damping: 15, stiffness: 150 });
          translateY.value = withSpring(0, { damping: 15, stiffness: 150 });
          // Sync to parent shared values
          if (translateXShared) translateXShared.value = withSpring(0, { damping: 15, stiffness: 150 });
          if (translateYShared) translateYShared.value = withSpring(0, { damping: 15, stiffness: 150 });
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
          // Sync to parent shared values
          if (translateXShared) translateXShared.value = withSpring(0, { damping: 15, stiffness: 150 });
          if (translateYShared) translateYShared.value = withSpring(0, { damping: 15, stiffness: 150 });
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

  // Check if this is a cloze card (contains cloze deletions) or Image Occlusion card
  const isClozeCard = card.front.includes('{{c');
  const isImageOcclusionCard = card.front.includes('<io-occlude') || card.back.includes('<io-occlude');

  // Memoize HTML strings to prevent re-processing and maintain stable references
  // CRITICAL: Depend on actual HTML content, not just ID, so edits are detected
  const frontHtml = React.useMemo(() => card.front, [card.front]);
  const backHtml = React.useMemo(() => card.back, [card.back]);
  const clozeBackHtml = React.useMemo(() => 
    `${card.front}<hr style="margin: 24px 0; border: none; border-top: 2px solid rgba(128,128,128,0.25);" /><div style="margin-top: 16px;">${card.back}</div>`,
    [card.front, card.back]
  );
  
  // Create content hash for keys to force remount when content changes
  const contentHash = React.useMemo(() => {
    return `${card.front.length}-${card.back.length}-${card.front.substring(0, 20)}`;
  }, [card.front, card.back]);

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

  // Smooth reveal - no flash for cloze/IO cards
  const frontOpacity = useAnimatedStyle(() => {
    // For cloze/IO cards, instant swap (no crossfade to prevent image flash)
    // For normal cards, smooth crossfade with midpoint
    const opacity = (isClozeCard || isImageOcclusionCard)
      ? interpolate(revealProgress.value, [0, 1], [1, 0], Extrapolate.CLAMP)
      : interpolate(revealProgress.value, [0, 0.5, 1], [1, 0, 0], Extrapolate.CLAMP);
    
    return { 
      opacity: opacity,
    };
  });
  
  const backOpacity = useAnimatedStyle(() => {
    // For cloze/IO cards, instant swap (no crossfade to prevent image flash)
    // For normal cards, smooth crossfade with midpoint
    const opacity = (isClozeCard || isImageOcclusionCard)
      ? interpolate(revealProgress.value, [0, 1], [0, 1], Extrapolate.CLAMP)
      : interpolate(revealProgress.value, [0, 0.5, 1], [0, 0, 1], Extrapolate.CLAMP);
    
    return { 
      opacity: opacity,
    };
  });

  // Static shadow - always visible (no animation, no prop changes = no flicker)

  // Shared values for swipe label (worklet-only, no React state to prevent flash)
  const swipeLabel = useSharedValue('GOOD');

  const overlayAnimatedStyle = useAnimatedStyle(() => {
    if (!isRevealed.value) return { opacity: 0 };

    const absX = Math.abs(translateX.value);
    const absY = Math.abs(translateY.value);
    const totalDistance = absX + absY;
    
    if (totalDistance < 30) return { opacity: 0 };
    
    // Opacity based on swipe distance (like Tinder)
    const opacity = Math.min(totalDistance / 150, 1);

    // Determine label based on swipe direction (all in worklet)
    if (absY > absX) {
      if (translateY.value > 0) {
        swipeLabel.value = 'AGAIN';
      } else {
        swipeLabel.value = 'EASY';
      }
    } else {
      if (translateX.value > 0) {
        swipeLabel.value = 'GOOD';
      } else {
        swipeLabel.value = 'HARD';
      }
    }

    return { opacity };
  });
  
  // Animated styles for each label (must be at component level, not in JSX)
  const againLabelStyle = useAnimatedStyle(() => ({ 
    opacity: swipeLabel.value === 'AGAIN' ? 1 : 0,
  }));
  
  const hardLabelStyle = useAnimatedStyle(() => ({ 
    opacity: swipeLabel.value === 'HARD' ? 1 : 0,
  }));
  
  const goodLabelStyle = useAnimatedStyle(() => ({ 
    opacity: swipeLabel.value === 'GOOD' ? 1 : 0,
  }));
  
  const easyLabelStyle = useAnimatedStyle(() => ({ 
    opacity: swipeLabel.value === 'EASY' ? 1 : 0,
  }));
  
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
      {/* Top area - edit button (left) and hint button (right) */}
      {!disabled && (
        <View style={styles.topArea}>
          {/* Edit button - top left */}
          <Pressable
            onPress={handleEdit}
            style={({ pressed }) => [
              styles.floatingButton,
              {
                backgroundColor: theme.colors.surface,
                borderWidth: 2,
                borderColor: 'rgba(128, 128, 128, 0.15)',
                opacity: pressed ? 0.7 : 1,
                transform: [{ scale: pressed ? 0.95 : 1 }],
              },
            ]}
          >
            <Ionicons name="create-outline" size={22} color={theme.colors.textPrimary} />
          </Pressable>

          {/* Hint/Tip button - top right */}
          {!revealed && (
            <Pressable 
              style={({ pressed }) => [
                styles.floatingButton, 
                { 
                  backgroundColor: theme.colors.surface,
                  borderWidth: 2,
                  borderColor: 'rgba(128, 128, 128, 0.15)',
                  opacity: pressed ? 0.7 : 1,
                  transform: [{ scale: pressed ? 0.95 : 1 }],
                }
              ]}
              onPress={() => {
                selection();
                if (hint) {
                  setShowHintModal(true);
                } else if (!aiHintsEnabled && !hintsLoading && onRequestEnableHints) {
                  onRequestEnableHints();
                }
              }}
            >
              <Ionicons 
                name="bulb-outline" 
                size={24} 
                color={theme.colors.textPrimary} 
              />
            </Pressable>
          )}
          {revealed && (
            <Pressable 
              style={({ pressed }) => [
                styles.floatingButton, 
                { 
                  backgroundColor: theme.colors.surface,
                  borderWidth: 2,
                  borderColor: 'rgba(128, 128, 128, 0.15)',
                  opacity: pressed ? 0.7 : 1,
                  transform: [{ scale: pressed ? 0.95 : 1 }],
                }
              ]}
              onPress={() => {
                selection();
                if (hint) {
                  setShowTipModal(true);
                } else if (!aiHintsEnabled && !hintsLoading && onRequestEnableHints) {
                  onRequestEnableHints();
                }
              }}
            >
              <Ionicons 
                name="sparkles" 
                size={24} 
                color={theme.colors.textPrimary} 
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
              scrollEnabled={isScrollEnabled}
              contentContainerStyle={styles.scrollContent}
            >
                {/* Spacer to establish scroll height */}
                <View style={{ opacity: 0, pointerEvents: 'none' }}>
                  <CardContentRenderer
                    key={`spacer-${card.id}-${contentHash}`}
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
                    key={`front-${card.id}-${contentHash}`}
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
                    key={`back-${card.id}-${contentHash}`}
                    html={isClozeCard ? clozeBackHtml : backHtml}
                    revealed={true}
                    clozeIndex={0}
                    cardId={card.id}
                  />
                </Animated.View>
            </Animated.ScrollView>
          </Animated.View>
        </View>

          {/* Tinder-style swipe overlay - render all 4 labels, show correct one via opacity */}
          <Animated.View style={[styles.swipeOverlay, overlayPositionStyle, overlayAnimatedStyle]} pointerEvents="none">
            {/* AGAIN label */}
            <Animated.View style={[
              styles.swipeLabelContainer, 
              { borderColor: '#EF4444', position: 'absolute' },
              againLabelStyle
            ]}>
              <Text style={[styles.swipeLabel, { color: '#EF4444' }]}>AGAIN</Text>
            </Animated.View>
            
            {/* HARD label */}
            <Animated.View style={[
              styles.swipeLabelContainer, 
              { borderColor: '#F59E0B', position: 'absolute' },
              hardLabelStyle
            ]}>
              <Text style={[styles.swipeLabel, { color: '#F59E0B' }]}>HARD</Text>
            </Animated.View>
            
            {/* GOOD label */}
            <Animated.View style={[
              styles.swipeLabelContainer, 
              { borderColor: '#10B981', position: 'absolute' },
              goodLabelStyle
            ]}>
              <Text style={[styles.swipeLabel, { color: '#10B981' }]}>GOOD</Text>
            </Animated.View>
            
            {/* EASY label */}
            <Animated.View style={[
              styles.swipeLabelContainer, 
              { borderColor: '#3B82F6', position: 'absolute' },
              easyLabelStyle
            ]}>
              <Text style={[styles.swipeLabel, { color: '#3B82F6' }]}>EASY</Text>
            </Animated.View>
          </Animated.View>
        </Animated.View>
      </GestureDetector>

      {/* Bottom Action Bar - Rating Buttons (Tinder-style, all same size) */}
      {!disabled && revealed && (
        <View style={styles.bottomActions} pointerEvents="box-none">
          <Pressable
            onPress={() => triggerRating('again')}
            style={({ pressed }) => [
              styles.ratingButton,
              { 
                backgroundColor: theme.isDark ? 'rgba(50, 50, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                opacity: pressed ? 0.7 : 1,
                transform: [{ scale: pressed ? 0.92 : 1 }],
              },
            ]}
          >
            <Ionicons name="close" size={28} color="#EF4444" />
          </Pressable>
          
          <Pressable
            onPress={() => triggerRating('hard')}
            style={({ pressed }) => [
              styles.ratingButton,
              { 
                backgroundColor: theme.isDark ? 'rgba(50, 50, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                opacity: pressed ? 0.7 : 1,
                transform: [{ scale: pressed ? 0.92 : 1 }],
              },
            ]}
          >
            <Ionicons name="alert-circle-outline" size={28} color="#F59E0B" />
          </Pressable>

          <Pressable
            onPress={() => triggerRating('good')}
            style={({ pressed }) => [
              styles.ratingButton,
              { 
                backgroundColor: theme.isDark ? 'rgba(50, 50, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                opacity: pressed ? 0.7 : 1,
                transform: [{ scale: pressed ? 0.92 : 1 }],
              },
            ]}
          >
            <Ionicons name="heart" size={28} color="#10B981" />
          </Pressable>

          <Pressable
            onPress={() => triggerRating('easy')}
            style={({ pressed }) => [
              styles.ratingButton,
              { 
                backgroundColor: theme.isDark ? 'rgba(50, 50, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                opacity: pressed ? 0.7 : 1,
                transform: [{ scale: pressed ? 0.92 : 1 }],
              },
            ]}
          >
            <Ionicons name="flash" size={28} color="#3B82F6" />
          </Pressable>
        </View>
      )}

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
  // Re-render if card ID, disabled state, OR hint changes
  // Hint updates are cheap (just icon visibility) and shouldn't cause re-mount
  const cardIdSame = prevProps.card.id === nextProps.card.id;
  const disabledSame = prevProps.disabled === nextProps.disabled;
  const hintSame = prevProps.hint === nextProps.hint;
  const shouldSkip = cardIdSame && disabledSame && hintSame;
  
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
    top: 60, // Fixed position below status bar, above card
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: s.xl,
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
    paddingTop: 20, // Extra padding to avoid icon overlap
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
  // Bottom action bar - Tinder-style rating buttons
  bottomActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: s.xl + 8,
    paddingBottom: s.xl + 32,
    gap: s.md,
    zIndex: 999,
  },
  ratingButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 12,
  },
});
