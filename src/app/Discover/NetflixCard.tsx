import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, interpolate, Extrapolate, SharedValue } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { DeckManifest } from '../../services/discover/DiscoverService';
import { buildDeckTheme, getDeckGlyphs } from './DeckTheme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.42;
const CARD_HEIGHT = CARD_WIDTH * 1.5;
const CARD_SPACING = 12;

interface NetflixCardProps {
  deck: DeckManifest;
  adjacentEmojis?: string[];
  scrollX?: SharedValue<number>;
  index?: number;
  onPress: (deck: DeckManifest) => void;
}

// Helper to get coin style based on variant with accent color and lighting
const getCoinStyle = (variant: 'circle' | 'squircle' | 'ring', accentColor: string) => {
  const seed = Math.abs(accentColor.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0));
  const sizeVariation = ((seed % 9) - 4); // -4 to +4
  const size = 88 + sizeVariation;
  const base = { width: size, height: size, alignItems: 'center' as const, justifyContent: 'center' as const, overflow: 'hidden' as const };
  switch (variant) {
    case 'circle':
      return { ...base, borderRadius: size / 2, backgroundColor: 'rgba(255,255,255,0.22)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.55)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4 };
    case 'squircle':
      return { ...base, borderRadius: size * 0.27, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.55)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4 };
    case 'ring':
      return { ...base, borderRadius: size / 2, borderWidth: 2, borderColor: accentColor + 'AA', shadowColor: accentColor, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 6 };
  }
};

export const NetflixCard = React.memo(function NetflixCard({ 
  deck, 
  adjacentEmojis = [], 
  scrollX, 
  index,
  onPress 
}: NetflixCardProps) {
  const deckTheme = useMemo(() => buildDeckTheme(deck), [deck.id]);
  const glyphs = useMemo(() => getDeckGlyphs(deck, adjacentEmojis), [deck.id, adjacentEmojis.join(',')]);
  const pressScale = useSharedValue(1);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 300 });
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    let scale = pressScale.value;
    
    // Scale-on-center effect for rails
    if (scrollX && index !== undefined) {
      const inputRange = [
        (index - 1) * (CARD_WIDTH + CARD_SPACING),
        index * (CARD_WIDTH + CARD_SPACING),
        (index + 1) * (CARD_WIDTH + CARD_SPACING),
      ];
      const centerScale = interpolate(
        scrollX.value,
        inputRange,
        [0.92, 1.0, 0.92],
        Extrapolate.CLAMP
      );
      scale = scale * centerScale;
    }
    
    return {
      transform: [{ scale }],
      opacity: opacity.value,
    };
  });

  const handlePressIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    pressScale.value = withSpring(0.95, { damping: 15, stiffness: 300 });
  };

  const handlePressOut = () => {
    pressScale.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress(deck);
  };

  return (
    <Animated.View style={[styles.netflixCard, animatedStyle]}>
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        {/* Unique Seeded Card */}
        <LinearGradient
          colors={deckTheme.colors}
          start={{ x: deckTheme.angle.x, y: 0 }}
          end={{ x: 1 - deckTheme.angle.x, y: 1 }}
          style={styles.posterCard}
        >
          {/* Single subtle background shape */}
          {deckTheme.shape === 'rings' && (
            <View style={[styles.shape, { top: '50%', left: '50%', marginLeft: -80, marginTop: -80, width: 160, height: 160, borderRadius: 80, borderWidth: 20, borderColor: 'rgba(255,255,255,0.05)' }]} />
          )}
          {deckTheme.shape === 'corner-circles' && (
            <View style={[styles.shape, { top: -50, right: -50, width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.06)' }]} />
          )}
          {deckTheme.shape === 'diagonal' && (
            <View style={[styles.shape, { top: 0, left: -100, right: -100, bottom: 0, transform: [{ rotate: '15deg' }], backgroundColor: 'rgba(255,255,255,0.04)' }]} />
          )}
          
          {/* Subtle noise texture */}
          <View style={[styles.shape, { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.03)', opacity: 0.5 }]} />

          {/* Dark Overlay for Text Legibility */}
          <LinearGradient
            colors={['transparent', 'transparent', 'rgba(0,0,0,0.85)']}
            locations={[0, 0.5, 1]}
            style={styles.posterOverlay}
          />

          {/* Content */}
          <View style={styles.posterContent}>
            {/* Icon/Emoji Coin with Variants */}
            <View style={[styles.posterIconContainer, glyphs.composition === 'topLeft' && { alignItems: 'flex-start', paddingLeft: 8 }]}>
              <View style={[
                getCoinStyle(glyphs.coinVariant, deckTheme.accentColor),
                { transform: [{ rotate: `${glyphs.rotation}deg` }] }
              ]}>
                {/* Radial highlight for lighting */}
                <LinearGradient
                  colors={['rgba(255,255,255,0.08)', 'transparent']}
                  style={StyleSheet.absoluteFillObject}
                  start={{ x: 0.3, y: 0.3 }}
                  end={{ x: 0.7, y: 0.7 }}
                />
                
                {/* Primary glyph (icon or emoji) */}
                {glyphs.primary.kind === 'icon' ? (
                  <Ionicons name={glyphs.primary.value as any} size={52 + glyphs.sizeVariation} color="#FFFFFF" style={{ textShadowColor: 'rgba(0,0,0,0.25)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 }} />
                ) : (
                  <Text style={[styles.coinEmoji, { fontSize: 52 + glyphs.sizeVariation }]}>{glyphs.primary.value}</Text>
                )}
              </View>
            </View>

            {/* Bottom Info */}
            <View style={styles.posterInfo}>
              <Text style={styles.posterTitle} numberOfLines={2}>
                {deck.name}
              </Text>
              <Text style={styles.posterMeta}>
                {deck.cardCount} • {deck.difficulty === 'beginner' ? 'Easy' : deck.difficulty === 'intermediate' ? 'Med' : 'Hard'}
              </Text>
            </View>
          </View>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}, (prevProps, nextProps) => {
  // Only re-render if deck ID, emojis, or index change
  const prevEmojis = (prevProps.adjacentEmojis || []).join(',');
  const nextEmojis = (nextProps.adjacentEmojis || []).join(',');
  return prevProps.deck.id === nextProps.deck.id &&
         prevEmojis === nextEmojis &&
         prevProps.index === nextProps.index &&
         prevProps.onPress === nextProps.onPress;
});

const styles = StyleSheet.create({
  netflixCard: {
    width: CARD_WIDTH,
  },
  posterCard: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  posterOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  shape: {
    position: 'absolute',
  },
  posterContent: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 14,
  },
  posterIconContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinEmoji: {
    fontSize: 52,
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  posterInfo: {
    gap: 4,
  },
  posterTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 18,
    letterSpacing: -0.3,
  },
  posterMeta: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
  },
});
