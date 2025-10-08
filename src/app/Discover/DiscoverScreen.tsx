import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/theme';
import { s } from '../../design/spacing';
import { r } from '../../design/radii';
import { DiscoverService, DeckManifest } from '../../services/discover/DiscoverService';
import { DeckDetailModal } from './DeckDetailModal';
import { useScheduler } from '../../context/SchedulerProvider';

export default function DiscoverScreen() {
  const theme = useTheme();
  const { reload } = useScheduler(); // Get reload function to refresh Decks screen
  const [decks, setDecks] = useState<DeckManifest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDeck, setSelectedDeck] = useState<DeckManifest | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState('');

  useEffect(() => {
    loadDecks();
  }, []);

  const loadDecks = async () => {
    try {
      setLoading(true);
      const catalog = await DiscoverService.getCatalog();
      setDecks(catalog.decks);
    } catch (error) {
      console.error('Failed to load decks:', error);
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
    } catch (error: any) {
      setImporting(false);
      setImportProgress('');
      throw error;
    }
  };
  const getIconForDeck = (deck: DeckManifest): keyof typeof Ionicons.glyphMap => {
    return (deck.thumbnail?.icon as keyof typeof Ionicons.glyphMap) || 'book';
  };

  const getIconColor = (deck: DeckManifest): string => {
    return deck.thumbnail?.color || '#6366F1';
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
      await importDeckFile(localUri, deck);
      
    } catch (error: any) {
      console.error('Download/Import failed:', error);
      Alert.alert('Failed', error.message || 'Failed to download or import deck');
    } finally {
      setDownloadingId(null);
      setDownloadProgress(0);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]} edges={['top']}>
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Discover</Text>
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
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Discover</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
          {decks.length} curated flashcard decks
        </Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.grid}>
        {decks.map((deck) => {
          const isDownloading = downloadingId === deck.id;
          const difficultyColor = deck.difficulty === 'beginner' ? '#10B981' : deck.difficulty === 'intermediate' ? '#F59E0B' : '#EF4444';
          const icon = getIconForDeck(deck);
          const iconColor = getIconColor(deck);
          
          return (
            <Pressable
              key={deck.id}
              style={[styles.card, { backgroundColor: theme.colors.surface }]}
              onPress={() => setSelectedDeck(deck)}
              disabled={isDownloading || importing}
            >
              <View style={[styles.iconContainer, { backgroundColor: iconColor + '20' }]}>
                <Ionicons name={icon} size={32} color={iconColor} />
              </View>
              
              <View style={styles.cardContent}>
                <Text style={[styles.deckName, { color: theme.colors.textPrimary }]}>
                  {deck.name}
                </Text>
                <Text style={[styles.deckDescription, { color: theme.colors.textSecondary }]}>
                  {deck.description}
                </Text>
                
                <View style={styles.cardFooter}>
                  <View style={styles.metaRow}>
                    <Ionicons name="layers" size={16} color={theme.colors.textTertiary} />
                    <Text style={[styles.metaText, { color: theme.colors.textTertiary }]}>
                      {deck.cardCount} cards
                    </Text>
                  </View>
                  
                  {isDownloading ? (
                    <View style={{ alignItems: 'center' }}>
                      {downloadProgress > 0 && downloadProgress < 100 ? (
                        <Text style={[styles.progressText, { color: theme.colors.accent }]}>
                          {Math.round(downloadProgress)}%
                        </Text>
                      ) : importing ? (
                        <Text style={[styles.progressText, { color: theme.colors.accent }]}>
                          {importProgress || 'Importing...'}
                        </Text>
                      ) : (
                        <ActivityIndicator size="small" color={theme.colors.accent} />
                      )}
                    </View>
                  ) : (
                    <View style={[styles.difficultyBadge, { backgroundColor: difficultyColor + '20' }]}>
                      <Text style={[styles.difficultyText, { color: difficultyColor }]}>
                        {deck.difficulty}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Deck Detail Modal */}
      {selectedDeck && (
        <DeckDetailModal
          deck={selectedDeck}
          visible={!!selectedDeck}
          onClose={() => setSelectedDeck(null)}
          onDownload={handleDownload}
          downloading={downloadingId === selectedDeck.id}
          downloadProgress={downloadProgress}
          importing={importing}
          importProgress={importProgress}
          icon={getIconForDeck(selectedDeck)}
          iconColor={getIconColor(selectedDeck)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: s.lg,
    paddingTop: s.md,
    paddingBottom: s.lg,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: s.xs,
  },
  subtitle: {
    fontSize: 14,
  },
  content: {
    flex: 1,
  },
  grid: {
    padding: s.md,
  },
  card: {
    borderRadius: r.lg,
    padding: s.lg,
    marginBottom: s.md,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: r.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: s.md,
  },
  cardContent: {
    gap: s.xs,
  },
  deckName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: s.xs,
  },
  deckDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: s.md,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.xs,
  },
  metaText: {
    fontSize: 13,
  },
  difficultyBadge: {
    paddingHorizontal: s.sm,
    paddingVertical: s.xs / 2,
    borderRadius: r.sm,
  },
  difficultyText: {
    fontSize: 12,
    fontWeight: '600',
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
