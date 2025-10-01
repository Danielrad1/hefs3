import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import ConfettiCannon from 'react-native-confetti-cannon';
import { useTheme } from '../../design';
import { useHaptics } from '../../hooks/useHaptics';
import { Difficulty } from '../../domain/srsTypes';
import { sampleCards } from '../../mocks/sampleCards';
import { useScheduler } from '../../context/SchedulerProvider';
import CardPage from './CardPage';

export default function StudyScreen() {
  const theme = useTheme();
  const haptics = useHaptics();
  const confettiRef = useRef<ConfettiCannon>(null);
  const { current, next, cardType, answer, bootstrap, currentDeckId, decks } = useScheduler();
  
  const [isCurrentRevealed, setIsCurrentRevealed] = useState(false);
  const [responseStartTime, setResponseStartTime] = useState(Date.now());
  
  const overlayColor = useSharedValue('rgba(0, 0, 0, 0)');

  // DO NOT bootstrap here - it overwrites imported decks!
  // Bootstrap is only called from Settings after import or on first launch
  // useEffect(() => {
  //   bootstrap(sampleCards);
  // }, [bootstrap]);
  
  // Reset overlay and revealed state when card changes
  useEffect(() => {
    overlayColor.value = withTiming('rgba(0, 0, 0, 0)', { duration: 300 });
    setIsCurrentRevealed(false);
    setResponseStartTime(Date.now());
  }, [current, overlayColor]);

  const handleAnswer = (difficulty: Difficulty) => {
    if (!current) return;

    // Trigger appropriate haptic feedback
    switch (difficulty) {
      case 'again':
        haptics.error();
        break;
      case 'hard':
        haptics.warning();
        break;
      case 'good':
        haptics.success();
        break;
      case 'easy':
        haptics.success();
        // Trigger confetti for easy answers
        confettiRef.current?.start();
        break;
    }

    // Calculate response time
    const responseTimeMs = Date.now() - responseStartTime;
    
    // Fade out color overlay smoothly as card flies away
    overlayColor.value = withTiming('rgba(0, 0, 0, 0)', { duration: 400 });
    
    // Delay state update to let card fly away animation complete
    setTimeout(() => {
      answer(difficulty, responseTimeMs);
    }, 250);
  };

  const handleSwipeChange = (translateX: number, translateY: number, isRevealed: boolean) => {
    if (!isRevealed) {
      overlayColor.value = withTiming('rgba(0, 0, 0, 0)', { duration: 400 });
      return;
    }

    const absX = Math.abs(translateX);
    const absY = Math.abs(translateY);
    const totalDistance = absX + absY;
    
    if (totalDistance < 10) {
      // Smooth fade out when releasing - animate the color itself
      overlayColor.value = withTiming('rgba(0, 0, 0, 0)', { duration: 400 });
      return;
    }
    
    // Calculate opacity based on distance
    const opacity = Math.min(totalDistance / 150, 0.3);

    // Determine color based on swipe direction
    let color = 'rgba(0, 0, 0, 0)';
    
    if (absY > absX) {
      if (translateY > 0) {
        // Red for Again (down swipe)
        color = `rgba(239, 68, 68, ${opacity})`;
      } else {
        // Green for Good (up swipe)
        color = `rgba(16, 185, 129, ${opacity})`;
      }
    } else {
      if (translateX > 0) {
        // Blue for Easy (right swipe)
        color = `rgba(59, 130, 246, ${opacity})`;
      } else {
        // Orange for Hard (left swipe)
        color = `rgba(249, 115, 22, ${opacity})`;
      }
    }

    // Instant color change during swipe, smooth fade on release
    overlayColor.value = color;
  };

  const overlayStyle = useAnimatedStyle(() => {
    return {
      backgroundColor: overlayColor.value,
    };
  });

  // Show message if no deck is selected
  if (currentDeckId === null) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.bg }]}>
        <View style={styles.emptyState}>
          <Text style={[styles.emptyTitle, { color: theme.colors.textPrimary }]}>
            No Deck Selected
          </Text>
          <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
            Please select a deck from the Decks tab to start studying
          </Text>
        </View>
      </View>
    );
  }

  if (!current) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.bg }]}>
        {/* TODO: Show completion screen */}
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      {/* Render next card behind (always visible for preview) */}
      {next && (
        <View key={`next-${next.id}`} style={[styles.cardWrapper, styles.nextCardWrapper]}>
          <CardPage
            card={next}
            onAnswer={() => {}}
            onSwipeChange={undefined}
            isCurrent={false}
            onReveal={undefined}
          />
        </View>
      )}

      {/* Render current card on top */}
      <View key={`current-${current.id}`} style={[styles.cardWrapper, styles.currentCardWrapper]}>
        <CardPage
          card={current}
          onAnswer={handleAnswer}
          onSwipeChange={handleSwipeChange}
          isCurrent={true}
          onReveal={() => setIsCurrentRevealed(true)}
        />
      </View>
      
      {/* Screen overlay for swipe feedback */}
      <Animated.View style={[styles.screenOverlay, overlayStyle]} pointerEvents="none" />
      
      <ConfettiCannon
        ref={confettiRef}
        count={50}
        origin={{ x: -10, y: 0 }}
        autoStart={false}
        fadeOut={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  cardWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  nextCardWrapper: {
    zIndex: 1,
  },
  currentCardWrapper: {
    zIndex: 10,
  },
  screenOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 5,
    pointerEvents: 'none',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
});
