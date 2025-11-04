import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Alert, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StackActions } from '@react-navigation/native';
import { useTheme } from '../../design/theme';
import { usePremium } from '../../context/PremiumContext';
import { s } from '../../design/spacing';
import { AiHintsService } from '../../services/ai/AiHintsService';
import { cardHintsService, CardHintsService } from '../../services/anki/CardHintsService';
import { deckMetadataService } from '../../services/anki/DeckMetadataService';
import { HintsInputItem } from '../../services/ai/types';
import HintsSuccessModal from '../../components/HintsSuccessModal';
import { db } from '../../services/anki/InMemoryDb';
import { useScheduler } from '../../context/SchedulerProvider';
import { logger } from '../../utils/logger';

interface AIHintsGeneratingScreenProps {
  route: {
    params: {
      deckId: string;
      deckName: string;
      items: HintsInputItem[];
      modelTier: 'basic' | 'advanced';
    };
  };
  navigation: any;
}

export default function AIHintsGeneratingScreen({ route, navigation }: AIHintsGeneratingScreenProps) {
  const theme = useTheme();
  const { deckId, deckName, items, modelTier } = route.params;
  const { setDeck } = useScheduler();
  const { incrementUsage } = usePremium();
  
  // TODO: Backend caps at 500 cards, but frontend doesn't validate before sending.
  // Should add validation in the flow that triggers this screen to prevent sending >500 cards.
  // For now, display the capped count to match what backend will actually process.
  const MAX_HINTS_CARDS = 500;
  const displayCardCount = Math.min(items.length, MAX_HINTS_CARDS);
  
  const [status, setStatus] = useState('Preparing...');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [generatedCount, setGeneratedCount] = useState(0);
  
  // Animations
  const sparkle1 = useRef(new Animated.Value(0)).current;
  const sparkle2 = useRef(new Animated.Value(0)).current;
  const sparkle3 = useRef(new Animated.Value(0)).current;
  const mainRotate = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const textBounce = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Main bulb rotation
    Animated.loop(
      Animated.timing(mainRotate, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Orbiting sparkles
    Animated.loop(
      Animated.timing(sparkle1, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    Animated.loop(
      Animated.timing(sparkle2, {
        toValue: 1,
        duration: 2500,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    Animated.loop(
      Animated.timing(sparkle3, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Text bounce animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(textBounce, {
          toValue: -10,
          duration: 600,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(textBounce, {
          toValue: 0,
          duration: 600,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const closeAiHintsFlow = useCallback(() => {
    const state = navigation.getState?.();
    // Pop all 3 AI hints screens (Config, ModelSelection, Generating) to return to deck screen
    const popCount = state ? Math.min(3, state.index + 1) : 1;

    if (popCount > 0) {
      navigation.dispatch(StackActions.pop(popCount));
    } else if (navigation.canGoBack?.()) {
      navigation.goBack();
    }
  }, [navigation]);

  const generateHints = useCallback(async () => {
    // Prevent multiple simultaneous executions
    if (isGenerating) {
      logger.info('[AIHintsGenerating] Already generating, skipping duplicate call');
      return;
    }

    try {
      setIsGenerating(true);
      setStatus('Generating hints...');

      // Enforce 500-card cap before sending to backend
      const itemsToSend = items.slice(0, MAX_HINTS_CARDS);
      
      if (items.length > MAX_HINTS_CARDS) {
        logger.warn(`[AIHintsGenerating] Clamping items from ${items.length} to ${MAX_HINTS_CARDS} before sending`);
      }

      // Log first 3 items to debug
      logger.info('[AIHintsGenerating] Sample items being sent (first 3):');
      itemsToSend.slice(0, 3).forEach((item, i) => {
        logger.info(`Item ${i}:`, {
          id: item.id,
          model: item.model,
          frontLength: item.front?.length || 0,
          backLength: item.back?.length || 0,
          clozeLength: item.cloze?.length || 0,
          frontPreview: item.front?.substring(0, 100),
          backPreview: item.back?.substring(0, 100),
          clozePreview: item.cloze?.substring(0, 100),
        });
      });

      const { hints, skipped } = await AiHintsService.generateHintsForCards(itemsToSend, {
        deckName,
        style: 'concise',
        modelTier, // Pass the selected model tier to the backend
      });

      if (skipped.length > 0) {
        logger.warn('[AIHintsGenerating] Skipped', skipped.length, 'cards:', skipped);
      }

      // If no hints were generated, check if it's due to skipping or an error
      if (hints.length === 0) {
        // If all cards were skipped due to validation, show specific message
        if (skipped.length === itemsToSend.length) {
          Alert.alert(
            'Unable to Generate Hints',
            'AI hints require text content to work. Your cards appear to contain only images or audio. Try adding text descriptions to your cards.',
            [
              {
                text: 'OK',
                onPress: () => {
                  navigation.goBack();
                },
              },
            ]
          );
        } else {
          // Backend returned 0 hints but didn't skip all cards - likely a backend error
          Alert.alert(
            'Generation Failed',
            'Something went wrong while generating hints. Please try again later.',
            [
              {
                text: 'OK',
                onPress: () => {
                  navigation.goBack();
                },
              },
            ]
          );
        }
        return;
      }

      setStatus('Saving hints...');

      logger.info('[AIHintsGenerating] Saving hints to database', {
        totalHints: hints.length,
      });
      const hintsToSave = hints.map((result) => {
        const inputItem = itemsToSend.find(i => i.id === result.id);
        const contentHash = CardHintsService.generateContentHash({
          front: inputItem?.front,
          back: inputItem?.back,
          cloze: inputItem?.cloze,
        });

        return {
          cardId: result.id,
          hintL1: result.hintL1,
          hintL2: result.hintL2,
          hintL3: result.hintL3,
          tip: result.tip,
          obstacle: result.obstacle,
          confusableContrast: result.metadata?.confusableContrast,
          tipType: result.metadata?.tipType,
          model: 'gpt-4o-mini',
          version: '2.0', // Updated version for multi-level hints
          createdAt: Date.now(),
          contentHash,
        };
      });

      await cardHintsService.setMany(deckId, hintsToSave);
      
      // Enable hints for this deck
      await deckMetadataService.setAiHintsEnabled(deckId, true);

      // Increment usage after successful generation (basic or advanced)
      await incrementUsage(modelTier === 'basic' ? 'basicHints' : 'advancedHints');

      setStatus('Hints ready!');
      setGeneratedCount(hints.length);
      setIsGenerating(false);
      setShowSuccessModal(true);
    } catch (error) {
      logger.error('[AIHintsGenerating] Generation failed:', error);
      setStatus('Generation failed. Please try again.');
      setIsGenerating(false);
      setShowSuccessModal(false);
      
      // Show alert immediately and go back
      Alert.alert(
        'Generation Failed',
        error instanceof Error ? error.message : 'Failed to generate hints. Please try again.',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ],
      );
    }
  }, [isGenerating, items, deckName, deckId, navigation, MAX_HINTS_CARDS]);

  useEffect(() => {
    generateHints();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Prevent back navigation during generation
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isGenerating) {
        // Prevent back navigation while generating
        return true;
      }
      return false;
    });

    return () => backHandler.remove();
  }, [isGenerating]);

  // Prevent swipe back gesture on iOS
  useEffect(() => {
    if (isGenerating) {
      navigation.setOptions({
        gestureEnabled: false,
      });
    } else {
      navigation.setOptions({
        gestureEnabled: true,
      });
    }
  }, [isGenerating, navigation]);

  const mainRotation = mainRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Orbiting sparkle positions
  const sparkle1X = sparkle1.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 360],
  });
  const sparkle1Y = sparkle1.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, -80, 0],
  });

  const sparkle2X = sparkle2.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 360],
  });
  const sparkle2Y = sparkle2.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 80, 0],
  });

  const sparkle3X = sparkle3.interpolate({
    inputRange: [0, 1],
    outputRange: [360, 0],
  });
  const sparkle3Y = sparkle3.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, -60, 0],
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]} edges={['top', 'bottom']}>
      <View style={styles.content}>
        {/* Main bulb icon with rotation and pulse */}
        <Animated.View
          style={[
            styles.mainIcon,
            {
              transform: [
                { rotate: mainRotation },
                { scale: pulseAnim },
              ],
            },
          ]}
        >
          <Ionicons name="bulb" size={80} color="#8B5CF6" />
        </Animated.View>

        {/* Orbiting sparkles */}
        <Animated.View
          style={[
            styles.orbitingSparkle,
            {
              transform: [
                { rotate: sparkle1X.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] }) },
                { translateX: 60 },
                { translateY: sparkle1Y },
              ],
            },
          ]}
        >
          <Ionicons name="sparkles" size={24} color="#EC4899" />
        </Animated.View>

        <Animated.View
          style={[
            styles.orbitingSparkle,
            {
              transform: [
                { rotate: sparkle2X.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] }) },
                { translateX: 70 },
                { translateY: sparkle2Y },
              ],
            },
          ]}
        >
          <Ionicons name="sparkles" size={20} color="#8B5CF6" />
        </Animated.View>

        <Animated.View
          style={[
            styles.orbitingSparkle,
            {
              transform: [
                { rotate: sparkle3X.interpolate({ inputRange: [0, 360], outputRange: ['360deg', '0deg'] }) },
                { translateX: 50 },
                { translateY: sparkle3Y },
              ],
            },
          ]}
        >
          <Ionicons name="sparkles" size={16} color="#EC4899" />
        </Animated.View>

        {/* Text with bounce animation */}
        <Animated.View style={{ transform: [{ translateY: textBounce }] }}>
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
            Generating Hints
          </Text>
        </Animated.View>
        
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
          {status}
        </Text>

        <View style={styles.tipContainer}>
          <Ionicons name="time-outline" size={20} color="#8B5CF6" />
          <Text style={[styles.tip, { color: theme.colors.textSecondary }]}>
            This will take 30 seconds to 1 minute—we're ensuring hint quality for {displayCardCount} cards. Feel free to continue studying; hints will be ready when you're done!
          </Text>
        </View>
      </View>

      {/* Success Modal */}
      <HintsSuccessModal
        visible={showSuccessModal}
        cardsWithHints={generatedCount}
        deckName={deckName}
        onStudyNow={() => {
          setShowSuccessModal(false);
          // Set the active deck and navigate to Study tab
          setDeck(deckId);
          const parent = navigation.getParent?.();
          closeAiHintsFlow();
          // Then navigate to Study tab once stack finishes closing
          setTimeout(() => {
            parent?.navigate('Study' as never);
          }, 100);
        }}
        onClose={() => {
          setShowSuccessModal(false);
          closeAiHintsFlow();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: s.xl,
  },
  mainIcon: {
    marginBottom: s['2xl'] * 2,
  },
  orbitingSparkle: {
    position: 'absolute',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: s['2xl'],
    marginBottom: s.md,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: s['2xl'],
    paddingHorizontal: s.xl,
  },
  tipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.sm,
    paddingHorizontal: s.lg,
    paddingVertical: s.md,
    borderRadius: 12,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
  },
  tip: {
    fontSize: 14,
    flex: 1,
  },
});
