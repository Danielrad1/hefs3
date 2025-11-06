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
import { CategoryRow } from './CategoryRow';
import { useScheduler } from '../../context/SchedulerProvider';
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
  const [selectedCategory, setSelectedCategory] = useState('All');
  const scrollY = useSharedValue(0);
  useEffect(() => {
    // Clear cache to ensure fresh data
    DiscoverService.clearCache();
    loadDecks();
  }, []);

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

  const importDeckFile = useCallback(async (fileUri: string, deck: DeckManifest) => {
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
  }, [reload]);
  
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

  // Memoize featured deck to prevent re-computation
  const featuredDeck = useMemo(() => {
    if (decks.length === 0) return null;
    return decks.find(d => d.id === 'milesdown-mcat')
      || decks.find(d => /milesdown/i.test(d.name))
      || decks[0];
  }, [decks]);

  // Stable callback for card press
  const handleCardPress = useCallback((deck: DeckManifest) => {
    setSelectedDeck(deck);
  }, []);

  const handleDownload = useCallback(async (deck: DeckManifest) => {
    try {
      setDownloadingId(deck.id);
      setDownloadProgress(0);
      setImporting(false);
      setImportProgress('');
      
      logger.info('[DiscoverScreen] Starting download for:', deck.name);
      logger.info('[DiscoverScreen] Download URL:', deck.downloadUrl);
      
      // Download the deck file with progress
      const localUri = await DiscoverService.downloadDeck(deck, (progress) => {
        logger.info('[DiscoverScreen] Progress update:', progress.toFixed(1) + '%');
        setDownloadProgress(progress);
      });
      
      logger.info('[DiscoverScreen] Download returned URI:', localUri);
      
      // Verify file exists and has size before importing
      const FileSystem = require('expo-file-system/legacy');
      const fileInfo = await FileSystem.getInfoAsync(localUri);
      logger.info('[DiscoverScreen] Downloaded file verification:', fileInfo);
      
      if (!fileInfo.exists) {
        throw new Error('Downloaded file does not exist at: ' + localUri);
      }
      
      if (fileInfo.size === 0) {
        throw new Error('Downloaded file is empty (0 bytes). Download URL may be incorrect or returning an error page.');
      }
      
      // If file is suspiciously small, read the content to see if it's an error message
      if (fileInfo.size < 1000) {
        logger.warn('[DiscoverScreen] File is only', fileInfo.size, 'bytes - reading content to check for errors...');
        const FileSystem = require('expo-file-system/legacy');
        const content = await FileSystem.readAsStringAsync(localUri);
        logger.error('[DiscoverScreen] Small file content:', content);
        
        // Check if it's a Firebase error response
        if (content.includes('"error"') && content.includes('"code"')) {
          try {
            const errorResponse = JSON.parse(content);
            if (errorResponse.error?.code === 404) {
              throw new Error('Deck file not found in Firebase Storage. The .apkg files need to be uploaded to Firebase Storage first.');
            } else if (errorResponse.error?.code === 403) {
              throw new Error('Permission denied accessing Firebase Storage. Check storage security rules.');
            } else {
              throw new Error('Firebase Storage error: ' + (errorResponse.error?.message || content));
            }
          } catch (parseError) {
            // If not JSON, throw generic error
            throw new Error('Downloaded file is too small (' + fileInfo.size + ' bytes). Content: ' + content);
          }
        }
        
        throw new Error('Downloaded file is too small (' + fileInfo.size + ' bytes). Expected at least 1KB for a valid deck file.');
      }
      
      logger.info('[DiscoverScreen] File verified, starting import...');
      
      // Reset download progress and start showing import progress
      setDownloadProgress(100); // Show download complete
      
      // Import the downloaded file (this will set importing=true and update importProgress)
      await importDeckFile(localUri, deck);
      
    } catch (error: any) {
      logger.error('Download/Import failed:', error);
      
      Alert.alert('Failed', error.message || 'Failed to download or import deck');
    } finally {
      setDownloadingId(null);
      setDownloadProgress(0);
      setImporting(false);
      setImportProgress('');
    }
  }, [importDeckFile, uid]);

  // Stable callbacks for HeroHeader (defined after handleDownload)
  const handleFeaturedDownload = useCallback(() => {
    if (featuredDeck) handleDownload(featuredDeck);
  }, [featuredDeck, handleDownload]);

  const handleFeaturedPreview = useCallback(() => {
    if (featuredDeck) setSelectedDeck(featuredDeck);
  }, [featuredDeck]);

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
        {!searchQuery.trim() && featuredDeck && (
          <HeroHeader
            deck={featuredDeck}
            scrollY={scrollY}
            onDownload={handleFeaturedDownload}
            onPreview={handleFeaturedPreview}
          />
        )}

        {!searchQuery.trim() && (
          <FilterChips
            categories={categories}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
          />
        )}

        {searchQuery.trim() ? (
          /* Search Results */
          <CategoryRow category="Search Results" decks={searchResults} onCardPress={handleCardPress} theme={theme} />
        ) : selectedCategory === 'All' ? (
          /* All Netflix Rows by Category */
          categories.map(category => {
            const categoryDecks = decksByCategory[category];
            if (!categoryDecks || categoryDecks.length === 0) return null;

            return (
              <CategoryRow 
                key={category} 
                category={category} 
                decks={categoryDecks} 
                onCardPress={handleCardPress} 
                theme={theme}
                onViewAll={() => navigation.navigate('CategoryDecks', { 
                  category, 
                  decks: categoryDecks,
                  onSelectDeck: (deck: DeckManifest) => setSelectedDeck(deck)
                })}
              />
            );
          })
        ) : (
          /* Filtered Category */
          <CategoryRow 
            category={selectedCategory} 
            decks={decksByCategory[selectedCategory] || []} 
            onCardPress={handleCardPress} 
            theme={theme}
          />
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
  progressText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
