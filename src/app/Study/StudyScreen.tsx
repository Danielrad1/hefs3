import React, { useState, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import ConfettiCannon from 'react-native-confetti-cannon';
import { useTheme } from '../../design';
import { useHaptics } from '../../hooks/useHaptics';
import { Card } from '../../domain/models';
import { Difficulty } from '../../domain/srsTypes';
import { sampleCards } from '../../mocks/sampleCards';
import CardPage from './CardPage';

export default function StudyScreen() {
  const theme = useTheme();
  const haptics = useHaptics();
  const confettiRef = useRef<ConfettiCannon>(null);
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cards] = useState(sampleCards);
  const [isCurrentRevealed, setIsCurrentRevealed] = useState(false);
  
  const overlayColor = useSharedValue('rgba(0, 0, 0, 0)');
  
  // Reset overlay and revealed state when card changes
  React.useEffect(() => {
    overlayColor.value = withTiming('rgba(0, 0, 0, 0)', { duration: 300 });
    setIsCurrentRevealed(false);
  }, [currentIndex, overlayColor]);

  const handleAnswer = (difficulty: Difficulty) => {
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

    // Future: This is where we'll call the SRS scheduler
    console.log(`Card ${cards[currentIndex].id} answered with difficulty: ${difficulty}`);
    
    // Fade out color overlay smoothly as card flies away
    overlayColor.value = withTiming('rgba(0, 0, 0, 0)', { duration: 400 });
    
    // Delay transition until card is off screen (250ms animation)
    setTimeout(() => {
      if (currentIndex < cards.length - 1) {
        setCurrentIndex(currentIndex + 1);
      }
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

  const currentCard = cards[currentIndex];
  const nextCard = currentIndex < cards.length - 1 ? cards[currentIndex + 1] : null;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      {/* Stack all cards - current one will be on top */}
      {cards.map((card, index) => {
        if (index < currentIndex) return null; // Don't render past cards
        if (index > currentIndex + 1) return null; // Only render current + next
        
        const isCurrent = index === currentIndex;
        const isNext = index === currentIndex + 1;
        
        // Only render next card if current card is revealed
        if (isNext && !isCurrentRevealed) return null;
        
        return (
          <View 
            key={card.id}
            style={[
              styles.cardWrapper,
              isCurrent ? styles.currentCardWrapper : styles.nextCardWrapper
            ]}
          >
            <CardPage
              card={card}
              onAnswer={isCurrent ? handleAnswer : () => {}}
              onSwipeChange={isCurrent ? handleSwipeChange : undefined}
              isCurrent={isCurrent}
              onReveal={isCurrent ? () => setIsCurrentRevealed(true) : undefined}
            />
          </View>
        );
      })}
      
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
});
