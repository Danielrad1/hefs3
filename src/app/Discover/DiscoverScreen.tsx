import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, ActivityIndicator, TextInput, FlatList, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, interpolate, Extrapolate, SharedValue } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { logger } from '../../utils/logger';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.42;
const CARD_HEIGHT = CARD_WIDTH * 1.5;
const CARD_SPACING = 12;
const SIDE_PADDING = 16;
import { useTheme } from '../../design/theme';
import { s } from '../../design/spacing';
import { r } from '../../design/radii';
import { DiscoverService, DeckManifest } from '../../services/discover/DiscoverService';
import { DeckDetailModal } from './DeckDetailModal';
import { HeroHeader } from './HeroHeader';
import { FilterChips } from './FilterChips';
import { buildDeckTheme, getDeckGlyphs } from './DeckTheme';
import { useScheduler } from '../../context/SchedulerProvider';
import OnboardingModal from '../../components/OnboardingModal';
import { FirstRunGuide } from '../../guided/FirstRunGuide';
import { useAuth } from '../../context/AuthContext';
export default function DiscoverScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const { reload } = useScheduler(); // Refresh deck list after import
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const [decks, setDecks] = useState<DeckManifest[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDeck, setSelectedDeck] = useState<DeckManifest | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const scrollY = useSharedValue(0);
  const [showPostImportModal, setShowPostImportModal] = useState(false);
  useEffect(() => {
    // Clear cache to ensure fresh data
    DiscoverService.clearCache();
    loadDecks();
  }, []);

  // Show import modal on first run
  useEffect(() => {
    if (!uid) {
      setShowImportModal(false);
      return;
    }
    FirstRunGuide.shouldShowDiscover(uid)
      .then((should) => setShowImportModal(should))
      .catch(() => setShowImportModal(false));
  }, [uid]);

  const loadDecks = async () => {
    try {
      setLoading(true);
      const catalog = await DiscoverService.getCatalog();
      setDecks(catalog.decks);
      
      // Reorder categories: MCAT, Law first (case-insensitive)
      const priority = catalog.categories.filter(c => 
        c.toUpperCase() === 'MCAT' || c.toUpperCase() === 'LAW'
      );
      const rest = catalog.categories.filter(c => 
        c.toUpperCase() !== 'MCAT' && c.toUpperCase() !== 'LAW'
      );
      setCategories([...priority, ...rest]);
    } catch (error) {
      logger.error('Failed to load decks:', error);
      Alert.alert('Error', 'Failed to load deck catalog. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const importDeckFile = async (fileUri: string, deck: DeckManifest) => {
    const ApkgParser = require('../../services/anki/ApkgParser').ApkgParser;
    const { db } = require('../../services/anki/InMemoryDb');
    const PersistenceService = require('../../services/anki/PersistenceService').PersistenceService;
    
    try {
      setImporting(true);
      setImportProgress('Parsing deck...');
      
      const parser = new ApkgParser();
      const parsed = await parser.parse(fileUri, {
        enableStreaming: true,
        onProgress: (msg: string) => {
          if (msg) setImportProgress(msg);
        },
      });
      
      // Import all data
      setImportProgress('Importing models...');
      if (parsed.col.models) {
        const modelsObj = typeof parsed.col.models === 'string' 
          ? JSON.parse(parsed.col.models) 
          : parsed.col.models;
        Object.values(modelsObj).forEach((model: any) => db.addModel(model));
      }
      
      setImportProgress('Importing decks...');
      Array.from(parsed.decks.values()).forEach((d: any) => db.addDeck(d));
      setImportProgress(`Importing ${parsed.notes.length} notes...`);
      parsed.notes.forEach((n: any) => db.addNote(n));
      
      setImportProgress(`Importing ${parsed.cards.length} cards...`);
      parsed.cards.forEach((c: any) => db.addCard(c));
      setImportProgress('Saving...');
      await PersistenceService.save(db);
      
      // Reload the Decks screen so it shows immediately
      reload();
      
      setImporting(false);
      setImportProgress('');
      setSelectedDeck(null); // Close modal
      
      Alert.alert(
        'Success!',
        `Imported ${parsed.cards.length} cards from "${deck.name}"`,
        [{ text: 'OK' }]
      );
      
      // Return parsed for signal
      return parsed;
    } catch (error: any) {
      setImporting(false);
      setImportProgress('');
      logger.error('[DiscoverScreen] Import failed:', error);
      Alert.alert(
        'Import Failed',
        error?.message || 'Failed to import deck. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };
  // Organize decks by category (Netflix rows)
  const decksByCategory = useMemo(() => {
    const organized: Record<string, DeckManifest[]> = {};
    
    categories.forEach(category => {
      organized[category] = decks.filter(deck =>
        deck.tags.some(tag => 
          tag.toLowerCase().includes(category.toLowerCase()) ||
          category.toLowerCase().includes(tag.toLowerCase())
        )
      );
    });
    
    return organized;
  }, [decks, categories]);

  // Search filtered decks
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    
    const query = searchQuery.toLowerCase();
    return decks.filter(deck =>
      deck.name.toLowerCase().includes(query) ||
      deck.description.toLowerCase().includes(query) ||
      deck.tags.some(tag => tag.toLowerCase().includes(query))
    );
  }, [decks, searchQuery]);


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

  const NetflixCard = ({ deck, adjacentEmojis = [], scrollX, index }: { deck: DeckManifest; adjacentEmojis?: string[]; scrollX?: SharedValue<number>; index?: number }) => {
    const isDownloading = downloadingId === deck.id;
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

    const handlePress = async () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setShowImportModal(false);
      try { await FirstRunGuide.markDiscoverShown(uid); } catch {}
      setSelectedDeck(deck);
    };

    return (
      <Animated.View style={[styles.netflixCard, animatedStyle]}>
        <Pressable
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={isDownloading || importing}
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

            {isDownloading && (
              <View style={styles.downloadingOverlay}>
                <ActivityIndicator size="small" color="#FFFFFF" />
              </View>
            )}
          </LinearGradient>
        </Pressable>
      </Animated.View>
    );
  };

  const CategoryRow = ({ category, decks }: { category: string; decks: DeckManifest[] }) => {
    const scrollX = useSharedValue(0);
    
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
          <Pressable 
            style={[styles.viewAllButton, { borderColor: theme.colors.border }]}
            onPress={() => navigation.navigate('CategoryDecks', { 
              category, 
              decks,
              onSelectDeck: (deck: DeckManifest) => setSelectedDeck(deck)
            })}
          >
            <Text style={[styles.viewAllText, { color: theme.colors.textSecondary }]}>View All</Text>
            <Ionicons name="chevron-forward" size={16} color={theme.colors.textSecondary} />
          </Pressable>
        </View>
        
        {/* Horizontal Scroll */}
        <Animated.FlatList
          data={decks}
          renderItem={({ item, index }) => {
            // Get adjacent emojis to avoid repetition
            const adjacentEmojis: string[] = [];
            if (index > 0) {
              const prevGlyphs = getDeckGlyphs(decks[index - 1]);
              adjacentEmojis.push(prevGlyphs.primary.value);
            }
            if (index < decks.length - 1) {
              const nextGlyphs = getDeckGlyphs(decks[index + 1]);
              adjacentEmojis.push(nextGlyphs.primary.value);
            }
            return <NetflixCard deck={item} adjacentEmojis={adjacentEmojis} scrollX={scrollX} index={index} />;
          }}
          onScroll={(event) => {
            scrollX.value = event.nativeEvent.contentOffset.x;
          }}
          scrollEventThrottle={16}
          keyExtractor={item => item.id}
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
  };

  const handleDownload = async (deck: DeckManifest) => {
    try {
      setDownloadingId(deck.id);
      setDownloadProgress(0);
      
      // Download the deck file with progress
      const localUri = await DiscoverService.downloadDeck(deck, (progress) => {
        setDownloadProgress(progress);
      });
      
      // Import the downloaded file
      const parsed = await importDeckFile(localUri, deck);

      // Mark guide complete and schedule study
      try { await FirstRunGuide.completeDiscover(uid); } catch {}

      // Only show modal if this is part of the tutorial
      const shouldShowTutorial = await FirstRunGuide.shouldShowDiscover(uid);
      if (shouldShowTutorial) {
        setShowPostImportModal(true);
      }
      
    } catch (error: any) {
      logger.error('Download/Import failed:', error);
      
      Alert.alert('Failed', error.message || 'Failed to download or import deck');
    } finally {
      setDownloadingId(null);
      setDownloadProgress(0);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]} edges={['top']}>
        <View style={styles.netflixHeader}>
          <Text style={[styles.netflixTitle, { color: theme.colors.textPrimary }]}>Discover</Text>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
          <Text style={{ color: theme.colors.textSecondary, marginTop: 16 }}>
            Loading decks...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]} edges={['top']}>
      {/* Netflix-style Header */}
      <View style={styles.netflixHeader}>
        <Text style={[styles.netflixTitle, { color: theme.colors.textPrimary }]}>
          Discover
        </Text>
        <Pressable 
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowSearch(!showSearch);
            if (showSearch) setSearchQuery('');
          }}
          hitSlop={12}
        >
          <Ionicons 
            name={showSearch ? "close" : "search"} 
            size={26} 
            color={theme.colors.textPrimary} 
          />
        </Pressable>
      </View>

      {/* Search Input (conditional) */}
      {showSearch && (
        <View style={[styles.searchBar, { backgroundColor: theme.colors.surface }]}>
          <Ionicons name="search" size={20} color={theme.colors.textTertiary} />
          <TextInput
            style={[styles.searchInput, { color: theme.colors.textPrimary }]}
            placeholder="Search decks..."
            placeholderTextColor={theme.colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
          <Pressable onPress={() => setSearchQuery('')}>
            <Ionicons name="close" size={20} color={theme.colors.textTertiary} />
          </Pressable>
        </View>
      )}

      <Animated.ScrollView 
        style={styles.netflixScroll}
        showsVerticalScrollIndicator={false}
        onScroll={(event) => {
          scrollY.value = event.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
      >
        {!searchQuery.trim() && decks.length > 0 && (() => {
          // Featured deck: MilesDown MCAT by priority
          const featuredDeck = decks.find(d => d.id === 'milesdown-mcat')
            || decks.find(d => /milesdown/i.test(d.name))
            || decks[0];
          
          return (
            <HeroHeader
              deck={featuredDeck}
              scrollY={scrollY}
              onDownload={() => handleDownload(featuredDeck)}
              onPreview={() => setSelectedDeck(featuredDeck)}
            />
          );
        })()}

        {!searchQuery.trim() && (
          <FilterChips
            categories={categories}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
          />
        )}

        {searchQuery.trim() ? (
          /* Search Results */
          <CategoryRow category="Search Results" decks={searchResults} />
        ) : selectedCategory === 'All' ? (
          /* All Netflix Rows by Category */
          categories.map(category => {
            const categoryDecks = decksByCategory[category];
            if (!categoryDecks || categoryDecks.length === 0) return null;

            return <CategoryRow key={category} category={category} decks={categoryDecks} />;
          })
        ) : (
          /* Filtered Category */
          <CategoryRow category={selectedCategory} decks={decksByCategory[selectedCategory] || []} />
        )}
      </Animated.ScrollView>

      {/* Deck Detail Modal */}
      {selectedDeck && (() => {
        const glyphs = getDeckGlyphs(selectedDeck);
        const deckTheme = buildDeckTheme(selectedDeck);
        return (
          <DeckDetailModal
            deck={selectedDeck}
            visible={!!selectedDeck}
            onClose={() => setSelectedDeck(null)}
            onDownload={handleDownload}
            downloading={downloadingId === selectedDeck.id}
            downloadProgress={downloadProgress}
            importing={importing}
            importProgress={importProgress}
            icon={glyphs.primary.value}
            iconColor={deckTheme.colors[0]}
          />
        );
      })()}

      {/* Import guide popup */}
      <OnboardingModal
        visible={showImportModal && decks.length > 0}
        icon="cloud-download-outline"
        title="Import Your First Deck"
        body="Tap any deck to preview it, then press Download. You can import Anki .apkg files or create decks with AI later from Decks."
        primaryLabel="Let's do it"
        onPrimary={async () => {
          setShowImportModal(false);
          try { await FirstRunGuide.markDiscoverShown(uid); } catch {}
        }}
      />

      {/* Post-import next step */}
      <OnboardingModal
        visible={showPostImportModal}
        icon="checkmark-circle-outline"
        title="Deck Imported"
        body="Great! Next, go to the Decks tab, open your deck, and press Study Now."
        primaryLabel="Go to Decks"
        onPrimary={() => {
          setShowPostImportModal(false);
          try { (navigation as any).navigate('Decks'); } catch {}
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // Netflix Header
  netflixHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 16,
  },
  netflixTitle: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  // Netflix Scroll
  netflixScroll: {
    flex: 1,
  },
  // Netflix Row (Category)
  netflixRow: {
    marginBottom: 24,
  },
  rowTitle: {
    fontSize: 20,
    fontWeight: '700',
    paddingHorizontal: 16,
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  // Netflix Section
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
  // Poster Card
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
  downloadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
  },
  // Search Results
  searchResults: {
    marginBottom: 24,
  },
  emptySearch: {
    paddingHorizontal: 16,
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
