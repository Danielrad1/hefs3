import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/theme';
import { s } from '../../design/spacing';
import { AiHintsService } from '../../services/ai/AiHintsService';
import { cardHintsService, CardHintsService } from '../../services/anki/CardHintsService';
import { deckMetadataService } from '../../services/anki/DeckMetadataService';
import { HintsInputItem } from '../../services/ai/types';

interface AIHintsGeneratingScreenProps {
  route: {
    params: {
      deckId: string;
      deckName: string;
      items: HintsInputItem[];
    };
  };
  navigation: any;
}

export default function AIHintsGeneratingScreen({ route, navigation }: AIHintsGeneratingScreenProps) {
  const theme = useTheme();
  const { deckId, deckName, items } = route.params;
  
  const [status, setStatus] = useState('Preparing...');
  const [isGenerating, setIsGenerating] = useState(false);
  
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

  const generateHints = useCallback(async () => {
    // Prevent multiple simultaneous executions
    if (isGenerating) {
      console.log('[AIHintsGenerating] Already generating, skipping duplicate call');
      return;
    }

    try {
      setIsGenerating(true);
      setStatus('Generating hints...');

      const { hints, skipped } = await AiHintsService.generateHintsForCards(items, {
        deckName,
        style: 'concise',
      });

      if (skipped.length > 0) {
        console.warn('[AIHintsGenerating] Skipped', skipped.length, 'cards:', skipped);
      }

      setStatus('Saving hints...');

      // Convert results to CardHint format and save
      console.log('[AIHintsGenerating] ===== GENERATED HINTS =====');
      const hintsToSave = hints.map(result => {
        const inputItem = items.find(i => i.id === result.id);
        const contentHash = CardHintsService.generateContentHash({
          front: inputItem?.front,
          back: inputItem?.back,
          cloze: inputItem?.cloze,
        });

        // Log each card with its hints
        console.log(`\n[Card ${result.id}]`);
        console.log('Front:', inputItem?.front?.substring(0, 100) + (inputItem?.front && inputItem.front.length > 100 ? '...' : ''));
        console.log('Back:', inputItem?.back?.substring(0, 100) + (inputItem?.back && inputItem.back.length > 100 ? '...' : ''));
        if (inputItem?.cloze) {
          console.log('Cloze:', inputItem.cloze.substring(0, 100) + (inputItem.cloze.length > 100 ? '...' : ''));
        }
        console.log('🎯 Obstacle:', result.obstacle || 'not specified');
        console.log('💡 Hint L1:', result.hintL1);
        console.log('💡 Hint L2:', result.hintL2);
        console.log('💡 Hint L3:', result.hintL3);
        console.log('✨ Tip:', result.tip);
        console.log('---');

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
      console.log('[AIHintsGenerating] ===== END HINTS =====');

      await cardHintsService.setMany(deckId, hintsToSave);
      
      // Enable hints for this deck
      await deckMetadataService.setAiHintsEnabled(deckId, true);

      setStatus('Complete!');

      // Replace navigation stack - prevent going back to this screen
      setTimeout(() => {
        navigation.replace('DeckDetail', { deckId });
      }, 1000);
    } catch (error) {
      console.error('[AIHintsGenerating] Generation failed:', error);
      setStatus('Generation failed. Please try again.');
      setIsGenerating(false);
      
      setTimeout(() => {
        navigation.goBack();
      }, 2000);
    }
  }, [isGenerating, items, deckName, deckId, navigation]);

  useEffect(() => {
    generateHints();
  }, [generateHints]);

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
          <Ionicons name="information-circle-outline" size={20} color="#8B5CF6" />
          <Text style={[styles.tip, { color: theme.colors.textSecondary }]}>
            Processing {items.length} cards with AI
          </Text>
        </View>
      </View>
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
