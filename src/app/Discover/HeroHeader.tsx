import React from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, interpolate, Extrapolate, SharedValue } from 'react-native-reanimated';
import { DeckManifest } from '../../services/discover/DiscoverService';
import { getDeckGlyphs, buildDeckTheme } from './DeckTheme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HERO_CARD_HEIGHT = SCREEN_WIDTH * 0.75;

interface HeroHeaderProps {
  deck: DeckManifest;
  scrollY: SharedValue<number>;
  onDownload: () => void;
  onPreview: () => void;
}

export function HeroHeader({ deck, scrollY, onDownload, onPreview }: HeroHeaderProps) {
  const glyphs = getDeckGlyphs(deck);
  const deckTheme = buildDeckTheme(deck);
  
  const animatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [0, HERO_CARD_HEIGHT * 0.5, HERO_CARD_HEIGHT],
      [1, 0.8, 0],
      Extrapolate.CLAMP
    );
    
    const scale = interpolate(
      scrollY.value,
      [0, HERO_CARD_HEIGHT],
      [1, 1.02],
      Extrapolate.CLAMP
    );

    return {
      opacity,
      transform: [{ scale }],
    };
  });

  return (
    <View style={styles.heroWrapper}>
      <Animated.View style={[styles.heroContainer, animatedStyle]}>
        <LinearGradient
          colors={deckTheme.colors}
          start={{ x: deckTheme.angle.x, y: 0 }}
          end={{ x: 1 - deckTheme.angle.x, y: 1 }}
          style={styles.heroGradient}
        >
          {/* Featured Badge */}
          <View style={styles.featuredBadge}>
            <Ionicons name="star" size={14} color="#FFD700" />
            <Text style={styles.featuredText}>Featured</Text>
          </View>

          {/* Dark Overlay */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.8)']}
            locations={[0, 0.6, 1]}
            style={styles.vignette}
          />

          {/* Large Icon */}
          <View style={styles.heroIconContainer}>
            {glyphs.primary.kind === 'icon' ? (
              <Ionicons name={glyphs.primary.value as any} size={100} color="#FFFFFF" />
            ) : (
              <Text style={styles.heroEmoji}>{glyphs.primary.value}</Text>
            )}
          </View>

          {/* Content */}
          <View style={styles.heroContent}>
            <Text style={styles.heroTitle} numberOfLines={2}>
              {deck.name}
            </Text>

            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Ionicons name="layers" size={16} color="rgba(255,255,255,0.9)" />
                <Text style={styles.metaText}>{deck.cardCount}</Text>
              </View>
              <View style={styles.metaDivider} />
              <View style={styles.metaItem}>
                <Ionicons name="time" size={16} color="rgba(255,255,255,0.9)" />
                <Text style={styles.metaText}>{Math.ceil(deck.cardCount / 20)} min</Text>
              </View>
              <View style={styles.metaDivider} />
              <Text style={styles.metaText}>
                {deck.difficulty === 'beginner' ? 'Easy' : deck.difficulty === 'intermediate' ? 'Medium' : 'Hard'}
              </Text>
            </View>

            <Pressable style={styles.previewButton} onPress={onPreview}>
              <Ionicons name="eye" size={20} color="#FFFFFF" />
              <Text style={styles.previewText}>Preview Deck</Text>
            </Pressable>
          </View>
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  heroWrapper: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  heroContainer: {
    width: SCREEN_WIDTH - 32,
    height: HERO_CARD_HEIGHT,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  heroGradient: {
    flex: 1,
    justifyContent: 'space-between',
  },
  featuredBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  featuredText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  vignette: {
    ...StyleSheet.absoluteFillObject,
  },
  heroIconContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 20,
  },
  heroEmoji: {
    fontSize: 100,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 8,
  },
  heroContent: {
    padding: 20,
    paddingBottom: 28,
    gap: 12,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 14,
    fontWeight: '600',
  },
  metaDivider: {
    width: 1,
    height: 14,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  previewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  previewText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
