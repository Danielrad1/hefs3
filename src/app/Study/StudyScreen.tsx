import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Text, Alert, InteractionManager } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import ConfettiCannon from 'react-native-confetti-cannon';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../design';
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
import StudyCoachOverlay from './StudyCoachOverlay';
import { FirstRunGuide } from '../../guided/FirstRunGuide';
import { useAuth } from '../../context/AuthContext';
import { logger } from '../../utils/logger';

interface StudyScreenProps {
  navigation?: any;
}

export default function StudyScreen({ navigation }: StudyScreenProps) {
  const theme = useTheme();
  const confettiRef = useRef<ConfettiCannon>(null);
  const { current, next, cardType, answer, bootstrap, currentDeckId, decks } = useScheduler();
  const { user } = useAuth();
  const uid = user?.uid || null;
  
  const [isCurrentRevealed, setIsCurrentRevealed] = useState(false);
  const [responseStartTime, setResponseStartTime] = useState(Date.now());
  const [hints, setHints] = useState<Map<string, CardHint>>(new Map());
  const [hintsLoading, setHintsLoading] = useState(true);
  const [aiHintsEnabled, setAiHintsEnabled] = useState(false);
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [currentCardMaxHintDepth, setCurrentCardMaxHintDepth] = useState<number | null>(null); // Track highest hint level revealed for current card
  const [showCoach, setShowCoach] = useState(false);
  const [coachStep, setCoachStep] = useState<'reveal' | 'swipe'>('reveal');
  const coachCompletedRef = React.useRef(false);
  
  // Shared values for UI-thread overlay computation
  const currentTranslateX = useSharedValue(0);
  const currentTranslateY = useSharedValue(0);
  const currentIsRevealed = useSharedValue(false);

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

  // First-run: show study coaching overlay when scheduled
  useEffect(() => {
    let mounted = true;
    const check = async () => {
      try {
        if (!uid) return;
        const should = await FirstRunGuide.shouldShowStudy(uid);
        if (mounted && should && current) {
          setCoachStep('reveal');
          setShowCoach(true);
          try { await FirstRunGuide.markStudyShown(uid); } catch {}
        }
      } catch {
        // no-op
      }
    };
    check();
    return () => { mounted = false; };
  }, [current, uid]);

  // Reload hints when screen comes into focus (e.g., after generating hints or editing)
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
  // Deferred behind interaction manager to never block UI interactions
  useEffect(() => {
    const handle = InteractionManager.runAfterInteractions(() => {
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
    });
    return () => handle.cancel();
  }, [current, next]);
  
  // Reset overlay and revealed state when card changes
  useEffect(() => {
    currentTranslateX.value = 0;
    currentTranslateY.value = 0;
    currentIsRevealed.value = false;
    setIsCurrentRevealed(false);
    setResponseStartTime(Date.now());
    setCurrentCardMaxHintDepth(null); // Reset hint tracking for new card
  }, [current, currentTranslateX, currentTranslateY, currentIsRevealed]);

  const handleAnswer = React.useCallback((difficulty: Difficulty) => {
    if (!current) return;

    // Haptics are handled in CardPage.tsx with specialized patterns
    // Only trigger confetti for easy answers FROM SWIPE (not button taps)
    // Button taps have small translateX/Y values (~200), swipes have large values (>400)
    const isSwipeGesture = Math.abs(currentTranslateX.value) > 300 || Math.abs(currentTranslateY.value) > 300;
    if (difficulty === 'easy' && isSwipeGesture) {
      confettiRef.current?.start();
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
      reviewTime: responseTimeMs,
    });
    
    // Mark study coach complete on first rating
    if (!coachCompletedRef.current) {
      coachCompletedRef.current = true;
      FirstRunGuide.completeStudy(uid).catch(() => {});
      setShowCoach(false);
    }

    // Reset translations (card flies away, overlay fades)
    currentTranslateX.value = withTiming(0, { duration: 400 });
    currentTranslateY.value = withTiming(0, { duration: 400 });
    
    // Delay state update to let card fly away animation complete
    setTimeout(() => {
      answer(difficulty, responseTimeMs);
    }, 250);
  }, [current, responseStartTime, currentTranslateX, currentTranslateY, answer, currentCardMaxHintDepth]);

  // No longer needed - overlay computed on UI thread

  // Compute overlay color entirely on UI thread from shared values
  const overlayStyle = useAnimatedStyle(() => {
    'worklet';
    if (!currentIsRevealed.value) {
      return { backgroundColor: 'rgba(0, 0, 0, 0)' };
    }

    const absX = Math.abs(currentTranslateX.value);
    const absY = Math.abs(currentTranslateY.value);
    const totalDistance = absX + absY;
    
    if (totalDistance < 30) {
      return { backgroundColor: 'rgba(0, 0, 0, 0)' };
    }
    
    // Calculate opacity based on distance
    const opacity = Math.min(totalDistance / 150, 0.45);

    // Determine color based on swipe direction
    let color = 'rgba(0, 0, 0, 0)';
    
    if (absY > absX) {
      if (currentTranslateY.value > 0) {
        // Red for Again (down swipe)
        color = `rgba(239, 68, 68, ${opacity})`;
      } else {
        // Blue for Easy (up swipe)
        color = `rgba(59, 130, 246, ${opacity})`;
      }
    } else {
      if (currentTranslateX.value > 0) {
        // Green for Good (right swipe)
        color = `rgba(16, 185, 129, ${opacity})`;
      } else {
        // Orange for Hard (left swipe)
        color = `rgba(249, 115, 22, ${opacity})`;
      }
    }

    return { backgroundColor: color };
  });

  // Removed next-card scale animation to prevent size bug during transitions

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
      logger.info('[StudyScreen] No currentDeckId');
      return;
    }
    
    const deck = db.getDeck(currentDeckId);
    if (!deck) {
      logger.info('[StudyScreen] Deck not found:', currentDeckId);
      return;
    }

    logger.info('[StudyScreen] Navigating to AIHintsConfig for deck:', deck.name);
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
        logger.info('[StudyScreen] Navigation triggered');
      } else {
        logger.info('[StudyScreen] No navigation prop');
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
      '🚀 Learn Faster',
      'AI hints streamline reviews and strengthen long‑term recall. Get progressive hints and memory techniques for every card.',
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
      });
    }
    if (current) {
      cardList.push({
        card: current,
        zIndex: 10,
        isCurrent: true,
      });
    }
    return cardList;
  }, [next, current]);

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
        {cards.map(({ card, zIndex, isCurrent }) => {
          const cardHint = hints.get(String(card.id)) || null;
          return (
            <React.Fragment key={card.id}>
              <Animated.View
                style={[
                  styles.cardWrapper,
                  { zIndex },
                ]}
                pointerEvents={isCurrent ? 'auto' : 'none'}
              >
                <CardPage
                  card={card}
                  onAnswer={handleAnswer}
                  translateXShared={isCurrent ? currentTranslateX : undefined}
                  translateYShared={isCurrent ? currentTranslateY : undefined}
                  isRevealedShared={isCurrent ? currentIsRevealed : undefined}
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

      {/* First-run Study Coach */}
      <StudyCoachOverlay
        visible={showCoach}
        step={coachStep}
        onNext={() => {
          if (coachStep === 'reveal') {
            setCoachStep('swipe');
          } else {
            setShowCoach(false);
          }
        }}
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

// Performance note: All swipe feedback (overlay color, next-card scale) computed on UI thread
// via worklet derived values from shared translateX/Y. Zero JS bridge traffic during gestures.
