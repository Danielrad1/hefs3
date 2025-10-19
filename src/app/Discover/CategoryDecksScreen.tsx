import React, { useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../design/theme';
import { DeckManifest } from '../../services/discover/DiscoverService';
import { buildDeckTheme, getDeckGlyphs } from './DeckTheme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.42;
const CARD_HEIGHT = CARD_WIDTH * 1.5;

type CategoryDecksRouteProp = RouteProp<{ params: { category: string; decks: DeckManifest[]; onSelectDeck?: (deck: DeckManifest) => void } }, 'params'>;

export default function CategoryDecksScreen() {
  const route = useRoute<CategoryDecksRouteProp>();
  const navigation = useNavigation();
  const theme = useTheme();
  const { category, decks, onSelectDeck } = route.params;

  const getCoinStyle = (variant: 'circle' | 'squircle' | 'ring') => {
    const base = { width: 88, height: 88, alignItems: 'center' as const, justifyContent: 'center' as const };
    switch (variant) {
      case 'circle':
        return { ...base, borderRadius: 44, backgroundColor: 'rgba(255,255,255,0.22)' };
      case 'squircle':
        return { ...base, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.18)' };
      case 'ring':
        return { ...base, borderRadius: 44, borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)' };
    }
  };

  const renderDeckCard = ({ item, index }: { item: DeckManifest; index: number }) => {
    const deckTheme = buildDeckTheme(item);
    
    // Get adjacent emojis to avoid repetition
    const adjacentEmojis: string[] = [];
    if (index > 0 && index % 2 === 1) {
      const leftGlyph = getDeckGlyphs(decks[index - 1]);
      adjacentEmojis.push(leftGlyph.primary.value);
    }
    const glyphs = getDeckGlyphs(item, adjacentEmojis);

    return (
      <Pressable 
        style={styles.gridCard}
        onPress={() => {
          if (onSelectDeck) {
            onSelectDeck(item);
          }
          navigation.goBack();
        }}
      >
        <LinearGradient
          colors={deckTheme.colors}
          start={{ x: deckTheme.angle.x, y: 0 }}
          end={{ x: 1 - deckTheme.angle.x, y: 1 }}
          style={styles.cardGradient}
        >
          {/* Background Shapes */}
          {deckTheme.shape === 'blob1' && (
            <>
              <View style={[styles.shape, { top: -20, right: -30, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.08)' }]} />
              <View style={[styles.shape, { bottom: -40, left: -20, width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(0,0,0,0.12)' }]} />
            </>
          )}
          {deckTheme.shape === 'blob2' && (
            <>
              <View style={[styles.shape, { top: 10, left: -40, width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.06)' }]} />
              <View style={[styles.shape, { bottom: 10, right: -30, width: 110, height: 110, borderRadius: 55, backgroundColor: 'rgba(0,0,0,0.08)' }]} />
            </>
          )}
          {deckTheme.shape === 'rings' && (
            <>
              <View style={[styles.shape, { top: '50%', left: '50%', marginLeft: -80, marginTop: -80, width: 160, height: 160, borderRadius: 80, borderWidth: 20, borderColor: 'rgba(255,255,255,0.06)' }]} />
            </>
          )}
          {deckTheme.shape === 'corner-circles' && (
            <>
              <View style={[styles.shape, { top: -50, right: -50, width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.1)' }]} />
              <View style={[styles.shape, { bottom: -50, left: -50, width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(0,0,0,0.1)' }]} />
            </>
          )}
          {deckTheme.shape === 'diagonal' && (
            <View style={[styles.shape, { top: 0, left: -100, right: -100, bottom: 0, transform: [{ rotate: '15deg' }], backgroundColor: 'rgba(255,255,255,0.04)' }]} />
          )}

          {/* Dark Overlay */}
          <LinearGradient
            colors={['transparent', 'transparent', 'rgba(0,0,0,0.85)']}
            locations={[0, 0.5, 1]}
            style={styles.overlay}
          />
          
          {/* Emoji Coin */}
          <View style={styles.iconContainer}>
            <View style={[
              getCoinStyle(glyphs.coinVariant),
              { transform: [{ rotate: `${glyphs.rotation}deg` }] }
            ]}>
              {glyphs.primary.kind === 'icon' ? (
                <Ionicons name={glyphs.primary.value as any} size={52 + glyphs.sizeVariation} color="#FFFFFF" />
              ) : (
                <Text style={styles.emoji}>{glyphs.primary.value}</Text>
              )}
            </View>
          </View>

          {/* Content */}
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {item.name}
            </Text>
            <Text style={styles.cardMeta}>
              {item.cardCount} • {item.difficulty === 'beginner' ? 'Easy' : item.difficulty === 'intermediate' ? 'Med' : 'Hard'}
            </Text>
          </View>
        </LinearGradient>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.surface }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </Pressable>
        <View style={styles.headerContent}>
          <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>{category}</Text>
          <Text style={[styles.headerSubtitle, { color: theme.colors.textTertiary }]}>
            {decks.length} deck{decks.length !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>

      {/* Grid */}
      <FlatList
        data={decks}
        renderItem={renderDeckCard}
        keyExtractor={item => item.id}
        numColumns={2}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.row}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 2,
  },
  grid: {
    padding: 16,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  gridCard: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    marginBottom: 16,
  },
  cardGradient: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  shape: {
    position: 'absolute',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  iconContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 52,
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  badge: {
    position: 'absolute',
    right: -4,
    top: -4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  cardContent: {
    padding: 14,
    gap: 4,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 18,
    letterSpacing: -0.3,
  },
  cardMeta: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
  },
});
