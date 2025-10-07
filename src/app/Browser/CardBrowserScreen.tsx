/**
 * CardBrowserScreen - Browse and filter cards Anki-style
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, ActivityIndicator, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../design/theme';
import { s } from '../../design/spacing';
import { r } from '../../design/radii';
import { db } from '../../services/anki/InMemoryDb';
import { CardService, CardQuery } from '../../services/anki/CardService';
import { SearchIndex } from '../../services/search/SearchIndex';
import { AnkiCard, FIELD_SEPARATOR } from '../../services/anki/schema';
import { PersistenceService } from '../../services/anki/PersistenceService';
import { useScheduler } from '../../context/SchedulerProvider';

interface FilterChip {
  id: string;
  label: string;
  type: 'deck' | 'tag' | 'is' | 'flag';
  value: string;
}

interface CardBrowserScreenProps {
  route?: {
    params?: {
      deckId?: string;
    };
  };
  navigation?: any;
}

export default function CardBrowserScreen({ route, navigation }: CardBrowserScreenProps) {
  const theme = useTheme();
  const { reload } = useScheduler();
  const deckId = route?.params?.deckId;
  const [searchText, setSearchText] = useState('');
  const [filters, setFilters] = useState<FilterChip[]>([]);
  const [cards, setCards] = useState<AnkiCard[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const searchIndexRef = useRef<SearchIndex | null>(null);
  const isIndexingRef = useRef(false);

  const cardService = useMemo(() => new CardService(db), []);

  // Load cards immediately on focus - no reindexing blocking
  useFocusEffect(
    useCallback(() => {
      loadCards();
    }, [])
  );

  // Lazy index only when search is actually used
  const ensureSearchIndex = useCallback(() => {
    if (!searchIndexRef.current && !isIndexingRef.current) {
      isIndexingRef.current = true;
      // Build index in background
      setTimeout(() => {
        if (__DEV__) {
          console.log('[CardBrowser] Building search index...');
        }
        searchIndexRef.current = new SearchIndex(db);
        searchIndexRef.current.indexAll();
        isIndexingRef.current = false;
        // Re-run search if there's active search text
        if (searchText.trim()) {
          loadCards();
        }
      }, 100);
    }
  }, [searchText]);

  // Trigger search index build when user starts typing
  useEffect(() => {
    if (searchText.trim()) {
      ensureSearchIndex();
    }
  }, [searchText, ensureSearchIndex]);

  // Load and filter cards with debouncing for search
  useEffect(() => {
    const timer = setTimeout(() => {
      loadCards();
    }, searchText ? 300 : 0);
    return () => clearTimeout(timer);
  }, [searchText, filters]);

  const loadCards = useCallback(() => {
    setIsLoading(true);
    // Use setTimeout to avoid blocking UI
    setTimeout(() => {
      let query: CardQuery = {};

      // If deckId provided, filter to that deck
      if (deckId) {
        const deck = db.getDeck(deckId);
        if (deck) {
          query.deck = deck.name;
        }
      }

      // Apply filter chips
      filters.forEach((filter) => {
        switch (filter.type) {
          case 'deck':
            query.deck = filter.value;
            break;
          case 'tag':
            query.tag = filter.value;
            break;
          case 'is':
            query.is = filter.value as any;
            break;
          case 'flag':
            query.flag = parseInt(filter.value);
            break;
        }
      });

      // Get cards matching query
      let filteredCards = cardService.findCards(query);

      // Apply text search if present and index is ready
      if (searchText.trim()) {
        if (searchIndexRef.current) {
          const noteIds = new Set(searchIndexRef.current.search(searchText, { limit: 500 }));
          filteredCards = filteredCards.filter((card) => noteIds.has(card.nid));
        }
        // If index not ready, show loading message
      }

      // Sort by due date (most urgent first)
      filteredCards.sort((a, b) => a.due - b.due);

      setCards(filteredCards);
      setIsLoading(false);
    }, 0);
  }, [deckId, filters, searchText, cardService]);

  const addFilter = (filter: FilterChip) => {
    // Prevent duplicate filters of the same type and value
    const exists = filters.some(f => f.type === filter.type && f.value === filter.value);
    if (!exists) {
      setFilters([...filters, filter]);
    }
  };
  const removeFilter = (filterId: string) => {
    setFilters(filters.filter((f) => f.id !== filterId));
  };


  const renderCard = useCallback(({ item: card }: { item: AnkiCard }) => {
    const note = db.getNote(card.nid);
    const deck = db.getDeck(card.did);

    if (!note) return null;
    const fields = note.flds.split(FIELD_SEPARATOR);
    const frontSnippet = fields[0] ? fields[0].replace(/<[^>]*>/g, '').substring(0, 100) : '';

    return (
      <Pressable
        style={[
          styles.cardRow,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
          },
        ]}
        onPress={() => {
          if (navigation) {
            navigation.navigate('NoteEditor', { noteId: card.nid, deckId: deckId });
          }
        }}
      >
        <View style={styles.cardContent}>
          <Text
            style={[styles.frontText, { color: theme.colors.textPrimary }]}
            numberOfLines={2}
          >
            {frontSnippet}
          </Text>
          <View style={styles.cardMeta}>
            <Text style={[styles.metaText, { color: theme.colors.textSecondary }]}>
              {deck?.name || 'Unknown'}
            </Text>
            <Text style={[styles.metaText, { color: theme.colors.textSecondary }]}>
              {card.type === 0 ? 'New' : card.type === 1 ? 'Learn' : 'Review'}
            </Text>
          </View>
        </View>
        {card.flags > 0 && (
          <View style={[styles.flag, { backgroundColor: getFlagColor(card.flags) }]} />
        )}
      </Pressable>
    );
  }, [theme, navigation]);

  const getFlagColor = (flag: number): string => {
    switch (flag) {
      case 1:
        return '#EF4444'; // red
      case 2:
        return '#F59E0B'; // orange
      case 3:
        return '#22C55E'; // green
      case 4:
        return '#3B82F6'; // blue
      default:
        return 'transparent';
    }
  };

  const deck = deckId ? db.getDeck(deckId) : null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]} edges={['top']}>
      {/* Header (when accessed from deck detail) */}
      {deckId && navigation && (
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <Pressable onPress={() => navigation.goBack()}>
            <Text style={[styles.backButton, { color: theme.colors.accent }]}>← Back</Text>
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]} numberOfLines={1}>
            {deck?.name.split('::').pop() || 'Cards'}
          </Text>
          <View style={{ width: 60 }} />
        </View>
      )}

      {/* Cards list with header components */}
      <FlashList
        data={cards}
        renderItem={renderCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            {/* Search bar */}
            <View style={styles.searchContainer}>
              <TextInput
                style={[
                  styles.searchInput,
                  {
                    backgroundColor: theme.colors.surface,
                    color: theme.colors.textPrimary,
                    borderColor: theme.colors.border,
                  },
                ]}
                placeholder="Search cards..."
                placeholderTextColor={theme.colors.textSecondary}
                value={searchText}
                onChangeText={setSearchText}
              />
            </View>

            {/* Filter chips */}
            {filters.length > 0 && (
              <ScrollView
                horizontal
                style={styles.filtersContainer}
                contentContainerStyle={styles.filtersContent}
                showsHorizontalScrollIndicator={false}
              >
                {filters.map((filter) => (
                  <Pressable
                    key={filter.id}
                    style={[styles.filterChip, { backgroundColor: theme.colors.accent }]}
                    onPress={() => removeFilter(filter.id)}
                  >
                    <Text style={styles.filterChipText}>{filter.label}</Text>
                    <Text style={styles.filterChipClose}>×</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}

            {/* Quick filters */}
            <ScrollView
              horizontal
              style={styles.quickFilters}
              contentContainerStyle={styles.quickFiltersContent}
              showsHorizontalScrollIndicator={false}
            >
              <Pressable
                style={[styles.quickFilter, { backgroundColor: theme.colors.surface }]}
                onPress={() =>
                  addFilter({ id: Date.now().toString(), label: 'New', type: 'is', value: 'new' })
                }
              >
                <Text style={[styles.quickFilterText, { color: theme.colors.textPrimary }]}>New</Text>
              </Pressable>
              <Pressable
                style={[styles.quickFilter, { backgroundColor: theme.colors.surface }]}
                onPress={() =>
                  addFilter({ id: Date.now().toString(), label: 'Due', type: 'is', value: 'due' })
                }
              >
                <Text style={[styles.quickFilterText, { color: theme.colors.textPrimary }]}>Due</Text>
              </Pressable>
              <Pressable
                style={[styles.quickFilter, { backgroundColor: theme.colors.surface }]}
                onPress={() =>
                  addFilter({
                    id: Date.now().toString(),
                    label: 'Suspended',
                    type: 'is',
                    value: 'suspended',
                  })
                }
              >
                <Text style={[styles.quickFilterText, { color: theme.colors.textPrimary }]}>
                  Suspended
                </Text>
              </Pressable>
            </ScrollView>

            {/* Results count */}
            <View style={styles.resultsHeader}>
              <Text style={[styles.resultsCount, { color: theme.colors.textSecondary }]}>
                {cards.length} cards
              </Text>
            </View>
          </>
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color={theme.colors.accent} />
              <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
                Loading cards...
              </Text>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyTitle, { color: theme.colors.textPrimary }]}>
                No cards found
              </Text>
              <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                {searchText || filters.length > 0
                  ? 'Try adjusting your search or filters'
                  : 'Import a deck to get started'}
              </Text>
            </View>
          )
        }
      />

      {/* Floating Action Button */}
      {deckId && navigation && (
        <Pressable
          style={[styles.fab, { backgroundColor: theme.colors.success }]}
          onPress={() => {
            const models = db.getAllModels();
            const modelId = models.length > 0 ? models[0].id : 1;
            navigation.navigate('NoteEditor', { deckId, modelId });
          }}
        >
          <Text style={styles.fabIcon}>+</Text>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: s.md,
    borderBottomWidth: 1,
  },
  backButton: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  addButton: {
    paddingHorizontal: s.md,
    paddingVertical: s.sm,
    borderRadius: r.md,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  searchContainer: {
    padding: s.md,
  },
  searchInput: {
    padding: s.md,
    borderRadius: r.md,
    borderWidth: 1,
    fontSize: 16,
  },
  filtersContainer: {
    maxHeight: 50,
  },
  filtersContent: {
    paddingHorizontal: s.md,
    gap: s.sm,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: s.xs,
    paddingHorizontal: s.md,
    borderRadius: r.pill,
    gap: s.xs,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  filterChipClose: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
  },
  quickFilters: {
    maxHeight: 70,
    marginBottom: s.xl,
  },
  quickFiltersContent: {
    paddingHorizontal: s.md,
    paddingVertical: s.lg,
    gap: s.md,
  },
  quickFilter: {
    paddingVertical: s.md,
    paddingHorizontal: s.xl,
    borderRadius: r.md,
    minHeight: 52,
    justifyContent: 'center',
  },
  quickFilterText: {
    fontSize: 16,
    fontWeight: '600',
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: s.md,
    paddingVertical: s.xs,
    marginTop: s.sm,
    marginBottom: s.md,
  },
  resultsCount: {
    fontSize: 12,
    opacity: 0.6,
  },
  listContent: {
    paddingHorizontal: s.md,
    paddingBottom: s.xl,
  },
  cardRow: {
    flexDirection: 'row',
    padding: s.md,
    borderRadius: r.md,
    borderWidth: 1,
    gap: s.md,
    marginBottom: s.sm,
  },
  cardContent: {
    flex: 1,
    gap: s.xs,
  },
  frontText: {
    fontSize: 14,
    fontWeight: '500',
  },
  cardMeta: {
    flexDirection: 'row',
    gap: s.md,
  },
  metaText: {
    fontSize: 12,
  },
  flag: {
    width: 4,
    borderRadius: 2,
  },
  loadingState: {
    padding: s['2xl'],
    alignItems: 'center',
    gap: s.md,
  },
  loadingText: {
    fontSize: 14,
  },
  emptyState: {
    padding: s['2xl'],
    alignItems: 'center',
    gap: s.sm,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    right: s.lg,
    bottom: s.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabIcon: {
    fontSize: 32,
    fontWeight: '300',
    color: '#000',
    marginTop: -2,
  },
});
