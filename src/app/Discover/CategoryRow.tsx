import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { DeckManifest } from '../../services/discover/DiscoverService';
import { buildDeckTheme, getDeckGlyphs } from './DeckTheme';
import { NetflixCard } from './NetflixCard';
import { useTheme } from '../../design/theme';

type ThemeType = ReturnType<typeof useTheme>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.42;
const CARD_SPACING = 12;
const SIDE_PADDING = 16;

interface CategoryRowProps {
  category: string;
  decks: DeckManifest[];
  onCardPress: (deck: DeckManifest) => void;
  theme: ThemeType;
  onViewAll?: () => void;
}

export const CategoryRow = React.memo(function CategoryRow({ 
  category, 
  decks, 
  onCardPress, 
  theme,
  onViewAll 
}: CategoryRowProps) {
  // Create scrollX once and keep it stable
  const scrollX = useSharedValue(0);
  
  // Memoize adjacent emojis calculation
  const decksWithAdjacentEmojis = useMemo(() => {
    return decks.map((deck, index) => {
      const adjacentEmojis: string[] = [];
      if (index > 0) {
        const prevGlyphs = getDeckGlyphs(decks[index - 1]);
        adjacentEmojis.push(prevGlyphs.primary.value);
      }
      if (index < decks.length - 1) {
        const nextGlyphs = getDeckGlyphs(decks[index + 1]);
        adjacentEmojis.push(nextGlyphs.primary.value);
      }
      return { deck, adjacentEmojis };
    });
  }, [decks]);

  if (decks.length === 0) {
    return (
      <View style={styles.emptySearch}>
        <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
          No results found
        </Text>
      </View>
    );
  }

  const categoryColor = buildDeckTheme(decks[0]).colors[0];

  return (
    <View style={[styles.netflixSection, { backgroundColor: theme.colors.surface }]}>
      {/* Section Header */}
      <View style={[styles.sectionHeader, { borderBottomColor: theme.colors.border }]}>
        <View style={styles.headerLeft}>
          <LinearGradient
            colors={[categoryColor, categoryColor + '80']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.categoryDot}
          />
          <View style={styles.titleContainer}>
            <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]} numberOfLines={1}>
              {category}
            </Text>
            <Text style={[styles.sectionSubtitle, { color: theme.colors.textTertiary }]}>
              {decks.length} deck{decks.length !== 1 ? 's' : ''} available
            </Text>
          </View>
        </View>
        {onViewAll && (
          <Pressable 
            style={[styles.viewAllButton, { borderColor: theme.colors.border }]}
            onPress={onViewAll}
          >
            <Text style={[styles.viewAllText, { color: theme.colors.textSecondary }]}>View All</Text>
            <Ionicons name="chevron-forward" size={16} color={theme.colors.textSecondary} />
          </Pressable>
        )}
      </View>
      
      {/* Horizontal Scroll */}
      <Animated.FlatList
        data={decksWithAdjacentEmojis}
        renderItem={({ item, index }) => (
          <NetflixCard 
            deck={item.deck} 
            adjacentEmojis={item.adjacentEmojis} 
            scrollX={scrollX} 
            index={index} 
            onPress={onCardPress} 
          />
        )}
        onScroll={(event) => {
          scrollX.value = event.nativeEvent.contentOffset.x;
        }}
        scrollEventThrottle={16}
        keyExtractor={item => item.deck.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_WIDTH + CARD_SPACING}
        decelerationRate="fast"
        snapToAlignment="start"
        contentContainerStyle={{ paddingHorizontal: SIDE_PADDING, gap: CARD_SPACING, paddingBottom: 20 }}
        getItemLayout={(_, index) => ({
          length: CARD_WIDTH + CARD_SPACING,
          offset: (CARD_WIDTH + CARD_SPACING) * index,
          index,
        })}
        removeClippedSubviews
        initialNumToRender={3}
        maxToRenderPerBatch={5}
        windowSize={7}
      />
    </View>
  );
}, (prevProps, nextProps) => {
  // Only re-render if these props change
  return prevProps.category === nextProps.category &&
         prevProps.decks.length === nextProps.decks.length &&
         prevProps.decks.every((d, i) => d.id === nextProps.decks[i]?.id) &&
         prevProps.onCardPress === nextProps.onCardPress &&
         prevProps.theme === nextProps.theme &&
         prevProps.onViewAll === nextProps.onViewAll;
});

const styles = StyleSheet.create({
  netflixSection: {
    marginBottom: 24,
    borderRadius: 20,
    paddingTop: 24,
    paddingBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    marginBottom: 16,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
  },
  categoryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  titleContainer: {
    flex: 1,
    gap: 4,
  },
  sectionTitle: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -1,
  },
  sectionSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '700',
  },
  emptySearch: {
    paddingHorizontal: 16,
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
  },
});
