import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Text, Alert } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, interpolate, Extrapolate } from 'react-native-reanimated';
import ConfettiCannon from 'react-native-confetti-cannon';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../design';
import { useHaptics } from '../../hooks/useHaptics';
import { Difficulty } from '../../domain/srsTypes';
import { sampleCards } from '../../mocks/sampleCards';
import { useScheduler } from '../../context/SchedulerProvider';
import { ImageCache } from '../../utils/ImageCache';
import CardPage from './CardPage';
import { cardHintsService, CardHint } from '../../services/anki/CardHintsService';
import { deckMetadataService } from '../../services/anki/DeckMetadataService';
import { db } from '../../services/anki/InMemoryDb';
import { hintEventsRepository } from '../../services/anki/db/HintEventsRepository';
import AIHintsPromoModal from './AIHintsPromoModal';

interface StudyScreenProps {
  navigation?: any;
}

export default function StudyScreen({ navigation }: StudyScreenProps) {
  const theme = useTheme();
  const haptics = useHaptics();
  const confettiRef = useRef<ConfettiCannon>(null);
  const { current, next, cardType, answer, bootstrap, currentDeckId, decks } = useScheduler();
  
  const [isCurrentRevealed, setIsCurrentRevealed] = useState(false);
  const [responseStartTime, setResponseStartTime] = useState(Date.now());
  const [hints, setHints] = useState<Map<string, CardHint>>(new Map());
  const [hintsLoading, setHintsLoading] = useState(true);
  const [aiHintsEnabled, setAiHintsEnabled] = useState(false);
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [currentCardMaxHintDepth, setCurrentCardMaxHintDepth] = useState<number | null>(null); // Track highest hint level revealed for current card
  
  const overlayColor = useSharedValue('rgba(0, 0, 0, 0)');
  const currentCardSwipeDistance = useSharedValue(0);

  // DO NOT bootstrap here - it overwrites imported decks!
  // Bootstrap is only called from Settings after import or on first launch
  // useEffect(() => {
  //   bootstrap(sampleCards);
  // }, [bootstrap]);
  
  // Load AI hints settings for current deck
  useEffect(() => {
    const loadSettings = async () => {
      if (currentDeckId) {
        const settings = await deckMetadataService.getAiHintsSettings(currentDeckId);
        setAiHintsEnabled(settings.enabled);
      } else {
        setAiHintsEnabled(false);
      }
    };
    loadSettings();
  }, [currentDeckId]);

  // Load hints for current and next cards
  useEffect(() => {
    const loadHints = async () => {
      setHintsLoading(true);
      const cardIds: string[] = [];
      if (current) cardIds.push(String(current.id));
      if (next) cardIds.push(String(next.id));
      
      if (cardIds.length > 0) {
        const loadedHints = await cardHintsService.getMany(cardIds);
        setHints(loadedHints);
      } else {
        setHints(new Map());
      }
      setHintsLoading(false);
    };
    loadHints();
  }, [current, next]);

  // Reload hints when screen comes into focus (e.g., after generating hints)
  useFocusEffect(
    React.useCallback(() => {
      const reloadHints = async () => {
        const cardIds: string[] = [];
        if (current) cardIds.push(String(current.id));
        if (next) cardIds.push(String(next.id));
        
        if (cardIds.length > 0) {
          const loadedHints = await cardHintsService.getMany(cardIds);
          setHints(loadedHints);
        }
      };
      reloadHints();
    }, [current, next])
  );
  
  // Preload images and dimensions for current and next cards
  // Deferred to prevent blocking UI - fire and forget
  useEffect(() => {
    // Defer preloading to next frame to not block rendering
    const timer = setTimeout(() => {
      if (current) {
        ImageCache.preloadImagesFromHtml(current.front).catch(() => {});
        ImageCache.preloadImagesFromHtml(current.back).catch(() => {});
        ImageCache.ensureDimensionsFromHtml(current.front).catch(() => {});
        ImageCache.ensureDimensionsFromHtml(current.back).catch(() => {});
      }
      if (next) {
        ImageCache.preloadImagesFromHtml(next.front).catch(() => {});
        ImageCache.preloadImagesFromHtml(next.back).catch(() => {});
        ImageCache.ensureDimensionsFromHtml(next.front).catch(() => {});
        ImageCache.ensureDimensionsFromHtml(next.back).catch(() => {});
      }
    }, 100); // Small delay to let UI render first
    return () => clearTimeout(timer);
  }, [current, next]);
  
  // Reset overlay and revealed state when card changes
  useEffect(() => {
    overlayColor.value = withTiming('rgba(0, 0, 0, 0)', { duration: 300 });
    currentCardSwipeDistance.value = 0; // Reset next card scale immediately
    setIsCurrentRevealed(false);
    setResponseStartTime(Date.now());
    setCurrentCardMaxHintDepth(null); // Reset hint tracking for new card
  }, [current, overlayColor, currentCardSwipeDistance]);

  const handleAnswer = React.useCallback((difficulty: Difficulty) => {
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
    
    // Record review with hint linkage
    const easeMap: Record<Difficulty, number> = {
      again: 1,
      hard: 2,
      good: 3,
      easy: 4,
    };
    const ease = easeMap[difficulty];
    
    hintEventsRepository.recordReview({
      cardId: String(current.id),
      deckId: currentDeckId || '', // FIXED: Pass deckId for deck-scoped analytics
      hintDepth: currentCardMaxHintDepth,
      reviewTimestamp: Date.now(),
      ease,
      wasSuccessful: ease >= 2,
    });
    
    // Fade out color overlay smoothly as card flies away
    overlayColor.value = withTiming('rgba(0, 0, 0, 0)', { duration: 400 });
    
    // Delay state update to let card fly away animation complete
    setTimeout(() => {
      answer(difficulty, responseTimeMs);
    }, 250);
  }, [current, haptics, responseStartTime, overlayColor, answer, currentCardMaxHintDepth]);

  const handleSwipeChange = React.useCallback((translateX: number, translateY: number, isRevealed: boolean) => {
    if (!isRevealed) {
      overlayColor.value = withTiming('rgba(0, 0, 0, 0)', { duration: 400 });
      currentCardSwipeDistance.value = 0;
      return;
    }

    const absX = Math.abs(translateX);
    const absY = Math.abs(translateY);
    const totalDistance = absX + absY;
    
    // Update swipe distance for next card scale animation
    currentCardSwipeDistance.value = totalDistance;
    
    if (totalDistance < 10) {
      // Smooth fade out when releasing - animate the color itself
      overlayColor.value = withTiming('rgba(0, 0, 0, 0)', { duration: 400 });
      currentCardSwipeDistance.value = withTiming(0, { duration: 400 });
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
  }, [overlayColor, currentCardSwipeDistance]);

  const overlayStyle = useAnimatedStyle(() => {
    return {
      backgroundColor: overlayColor.value,
    };
  });

  // Next card scale animation based on current card swipe distance
  // MUST be before conditional returns to avoid hook ordering issues
  const nextCardStyle = useAnimatedStyle(() => {
    // Scale from 0.94 to 1.0 as current card swipes away (more dramatic effect)
    const scale = interpolate(
      currentCardSwipeDistance.value,
      [0, 100],
      [0.94, 1.0],
      Extrapolate.CLAMP
    );
    
    // Move up slightly as it scales (creates depth effect)
    const translateY = interpolate(
      currentCardSwipeDistance.value,
      [0, 100],
      [20, 0],
      Extrapolate.CLAMP
    );
    
    return {
      transform: [
        { scale },
        { translateY },
      ],
    };
  }, [currentCardSwipeDistance]);

  // Memoized callbacks for preview card
  const emptyOnAnswer = React.useCallback(() => {}, []);
  const handleReveal = React.useCallback(() => {
    setIsCurrentRevealed(true);
  }, []);

  const handleRequestEnableHints = React.useCallback(() => {
    setShowPromoModal(true);
  }, []);

  const handleHintRevealed = React.useCallback((depth: 1 | 2 | 3) => {
    if (!current || !currentDeckId) return;
    
    // Track this hint reveal
    hintEventsRepository.recordHintRevealed({
      cardId: String(current.id),
      deckId: currentDeckId,
      depth,
      timestamp: Date.now(),
    });
    
    // Update the max depth for this card
    setCurrentCardMaxHintDepth(prevDepth => 
      prevDepth === null ? depth : Math.max(prevDepth, depth)
    );
  }, [current, currentDeckId]);

  const handleEnableHints = React.useCallback(() => {
    if (!currentDeckId) {
      console.log('[StudyScreen] No currentDeckId');
      return;
    }
    
    const deck = db.getDeck(currentDeckId);
    if (!deck) {
      console.log('[StudyScreen] Deck not found:', currentDeckId);
      return;
    }

    console.log('[StudyScreen] Navigating to AIHintsConfig for deck:', deck.name);
    setShowPromoModal(false);
    
    // Small delay to let modal close animation finish
    setTimeout(() => {
      // Navigate to Decks tab - navigation is the tab navigator
      if (navigation) {
        navigation.navigate('Decks', {
          screen: 'AIHintsConfig',
          params: {
            deckId: currentDeckId,
            deckName: deck.name,
            totalCards: db.getCardsByDeck(currentDeckId).length,
          },
        });
        console.log('[StudyScreen] Navigation triggered');
      } else {
        console.log('[StudyScreen] No navigation prop');
      }
    }, 100);
  }, [currentDeckId, navigation]);

  const handleClosePromoModal = React.useCallback(() => {
    setShowPromoModal(false);
  }, []);

  // Old alert-based handler (keeping structure for reference)
  const _oldHandleRequestEnableHints = React.useCallback(() => {
    if (!currentDeckId) return;
    
    const deck = db.getDeck(currentDeckId);
    if (!deck) return;

    Alert.alert(
      '🚀 Learn 40% Faster',
      'AI hints cut your reviews from 10 to 6 sessions and double how long you remember. Get progressive hints and memory techniques for every card.',
      [
        { text: 'Not Now', style: 'cancel' },
        {
          text: 'Enable AI Hints',
          onPress: () => {
            // Navigate to Decks tab, then to deck detail, then to hints config
            const parent = navigation?.getParent();
            if (parent) {
              parent.navigate('Decks', {
                screen: 'AIHintsConfig',
                params: {
                  deckId: currentDeckId,
                  deckName: deck.name,
                  totalCards: db.getCardsByDeck(currentDeckId).length,
                },
              });
            }
          },
        },
      ]
    );
  }, [currentDeckId, navigation]);

  // Collect all visible cards in a single flat array with stable keys
  // MUST be before conditional returns to avoid hook ordering issues
  const cards = React.useMemo(() => {
    const cardList = [];
    if (next) {
      cardList.push({
        card: next,
        zIndex: 1,
        isCurrent: false,
        style: nextCardStyle,
      });
    }
    if (current) {
      cardList.push({
        card: current,
        zIndex: 10,
        isCurrent: true,
        style: null,
      });
    }
    return cardList;
  }, [next, current, nextCardStyle]);

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
        <View style={styles.emptyState}>
          <Text style={[styles.completionEmoji]}>🎉</Text>
          <Text style={[styles.emptyTitle, { color: theme.colors.textPrimary }]}>
            All Done!
          </Text>
          <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
            You've reviewed all cards for this deck.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      {/* Card stack - all cards in same flat structure for React reconciliation */}
      <View style={styles.cardStack}>
        {cards.map(({ card, zIndex, isCurrent, style }) => {
          const cardHint = hints.get(String(card.id)) || null;
          // Include hint availability in key to force re-render when hints load
          const cardKey = `${card.id}-${cardHint ? 'with-hint' : 'no-hint'}`;
          return (
            <React.Fragment key={cardKey}>
              <Animated.View
                style={[
                  styles.cardWrapper,
                  { zIndex },
                  style,
                ]}
                pointerEvents={isCurrent ? 'auto' : 'none'}
              >
                <CardPage
                  card={card}
                  onAnswer={handleAnswer}
                  onSwipeChange={handleSwipeChange}
                  onReveal={handleReveal}
                  disabled={!isCurrent}
                  hint={cardHint}
                  onRequestEnableHints={handleRequestEnableHints}
                  aiHintsEnabled={aiHintsEnabled}
                  hintsLoading={hintsLoading}
                  onHintRevealed={handleHintRevealed}
                />
              </Animated.View>
            </React.Fragment>
          );
        })}
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

      {/* AI Hints Promo Modal */}
      <AIHintsPromoModal
        visible={showPromoModal}
        onClose={handleClosePromoModal}
        onEnable={handleEnableHints}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  cardStack: {
    flex: 1,
    position: 'relative',
  },
  cardWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
  completionEmoji: {
    fontSize: 64,
    marginBottom: 16,
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
