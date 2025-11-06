import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/theme';
import { usePremium } from '../../context/PremiumContext';
import { s } from '../../design/spacing';
import { AiService } from '../../services/ai/AiService';
import { logger } from '../../utils/logger';

interface AIGeneratingScreenProps {
  route: {
    params: {
      prompt: string;
      notesText: string;
      noteModel: string;
      itemLimit: number;
      modelTier: 'basic' | 'advanced';
    };
  };
  navigation: any;
}

export default function AIGeneratingScreen({ route, navigation }: AIGeneratingScreenProps) {
  const theme = useTheme();
  const { incrementUsage } = usePremium();
  const { prompt, notesText, noteModel, itemLimit, modelTier } = route.params;

  // Generate deck on mount
  useEffect(() => {
    const abortController = new AbortController();
    let isMounted = true;

    const generateDeck = async () => {
      try {
        const sourceType = notesText.trim() ? 'notes' : 'prompt';
        
        const response = await AiService.generateDeck({
          sourceType,
          prompt: prompt.trim() ? prompt : undefined,
          notesText: notesText.trim() ? notesText : undefined,
          deckName: undefined,
          noteModel: noteModel as 'basic' | 'cloze',
          itemLimit,
          modelTier, // Pass the selected model tier
        }, abortController.signal);

        // Only proceed if component is still mounted
        if (!isMounted) {
          logger.info('[AIGenerating] Component unmounted, skipping navigation');
          return;
        }

        // Increment usage after successful generation
        await incrementUsage(modelTier === 'basic' ? 'basicDecks' : 'advancedDecks');

        // Replace loading screen with preview (can't go back to loading)
        navigation.replace('AIDeckPreview', {
          deckName: response.deckName,
          noteModel: response.model,
          notes: response.notes,
          metadata: response.metadata,
        });
      } catch (error) {
        // Ignore abort errors when user navigates away
        if (error instanceof Error && error.name === 'AbortError') {
          logger.info('[AIGenerating] Generation cancelled by user navigation');
          return;
        }

        // Only show error if component is still mounted
        if (!isMounted) {
          logger.info('[AIGenerating] Component unmounted, skipping error handling');
          return;
        }

        logger.error('[AIGenerating] Deck generation error:', error);
        // Go back to creator screen
        navigation.navigate('AIDeckCreator');
        
        const errorMessage = error instanceof Error ? error.message : '';
        Alert.alert(
          'Generation Failed',
          errorMessage || 'Failed to generate deck. Please try again.'
        );
      }
    };
    
    generateDeck();

    // Cleanup: abort request and mark component as unmounted
    return () => {
      isMounted = false;
      abortController.abort();
      logger.info('[AIGenerating] Cleanup: Aborting deck generation request');
    };
  }, []);

  // Multiple sparkle animations
  const sparkle1 = useRef(new Animated.Value(0)).current;
  const sparkle2 = useRef(new Animated.Value(0)).current;
  const sparkle3 = useRef(new Animated.Value(0)).current;
  const mainRotate = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const textBounce = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Main sparkle rotation
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
        {/* Main sparkle icon with rotation and pulse */}
        <Animated.View
          style={[
            styles.mainSparkle,
            {
              transform: [
                { rotate: mainRotation },
                { scale: pulseAnim },
              ],
            },
          ]}
        >
          <Ionicons name="sparkles" size={80} color="#8B5CF6" />
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
            Creating Your Deck
          </Text>
        </Animated.View>
        
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
          AI is analyzing your content and generating flashcards...
        </Text>

        <View style={styles.tipContainer}>
          <Ionicons name="bulb-outline" size={20} color="#8B5CF6" />
          <Text style={[styles.tip, { color: theme.colors.textSecondary }]}>
            This may take a couple minutes for very large documents
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
  mainSparkle: {
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
