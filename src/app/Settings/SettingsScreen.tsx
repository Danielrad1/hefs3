import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../design/theme';
import { s } from '../../design/spacing';
import { r } from '../../design/radii';
import { ApkgParser } from '../../services/anki/ApkgParser';
import { db } from '../../services/anki/InMemoryDb';
import { PersistenceService } from '../../services/anki/PersistenceService';
import { MediaService } from '../../services/anki/MediaService';
import { useScheduler } from '../../context/SchedulerProvider';

export default function SettingsScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const { bootstrap, reload, setDeck } = useScheduler();
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<string>('');

  const handleImportDeck = async () => {
    try {
      setImporting(true);
      setProgress('Select a file...');

      // Let user pick an .apkg file
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/octet-stream', // .apkg files
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        setImporting(false);
        setProgress('');
        return;
      }

      const file = result.assets[0];
      
      // Validate file extension
      if (!file.name.endsWith('.apkg')) {
        Alert.alert('Invalid File', 'Please select an Anki deck file (.apkg)');
        setImporting(false);
        setProgress('');
        return;
      }

      setProgress('Reading file...');
      
      // Parse .apkg
      const parser = new ApkgParser();
      const parsed = await parser.parse(file.uri);

      setProgress('Loading into database...');
      
      // Don't clear - merge with existing data
      // Collection metadata can be updated if needed (col always exists)
      // Optionally merge timestamps, but keep existing nextPos etc.

      // Import models from collection
      console.log('[Settings] Importing models...');
      if (parsed.col.models) {
        const modelsObj = typeof parsed.col.models === 'string' 
          ? JSON.parse(parsed.col.models) 
          : parsed.col.models;
        
        Object.values(modelsObj).forEach((model: any) => {
          console.log('[Settings] - Model:', model.name, '(id:', model.id + ')');
          db.addModel(model);
        });
      }

      // Import deck configs
      console.log('[Settings] Importing deck configs...');
      if (parsed.deckConfigs && parsed.deckConfigs.size > 0) {
        parsed.deckConfigs.forEach((config) => {
          console.log('[Settings] - Deck config:', config.name, '(id:', config.id + ')');
          db.addDeckConfig(config);
        });
      }

      // Import decks (will merge with existing)
      console.log('[Settings] Importing', parsed.decks.size, 'decks:');
      parsed.decks.forEach((deck) => {
        console.log('[Settings] - Deck:', deck.name, '(id:', deck.id + ')');
        db.addDeck(deck);
      });

      // Import notes
      console.log('[Settings] Importing', parsed.notes.length, 'notes');
      parsed.notes.forEach((note) => {
        db.addNote(note);
      });

      // Import cards
      console.log('[Settings] Importing', parsed.cards.length, 'cards');
      parsed.cards.forEach((card) => {
        db.addCard(card);
      });

      // Register media files in database for GC and dedupe
      console.log('[Settings] Registering', parsed.mediaFiles.size, 'media files in DB...');
      const mediaService = new MediaService(db);
      // Media files are already written by ApkgParser to media/ dir
      // Just register them in the database (no copying needed)
      for (const [mediaId, filename] of parsed.mediaFiles.entries()) {
        try {
          const media = await mediaService.registerExistingMedia(filename);
          if (media && __DEV__) {
            console.log('[Settings] - Registered media:', filename);
          } else if (!media) {
            console.warn('[Settings] - Could not register media:', filename);
          }
        } catch (error) {
          console.error('[Settings] Error registering media:', filename, error);
        }
      }
      
      // Verify what's in the database after import
      const allDecks = db.getAllDecks();
      console.log('[Settings] After import, database has', allDecks.length, 'decks:');
      allDecks.forEach(d => {
        const deckCards = db.getCardsByDeck(d.id);
        console.log('[Settings] -', d.name, ':', deckCards.length, 'cards');
      });

      setProgress('Saving...');
      
      // Save database to persistent storage
      await PersistenceService.save(db);
      
      setProgress('Complete!');
      
      // Reset to "All Decks" so imported cards are visible
      setDeck(null);
      
      // Reload scheduler to pick up new decks
      reload();
      
      setImporting(false);
      setProgress('');
      
      Alert.alert(
        'Import Successful',
        `Imported ${parsed.cards.length} cards from ${parsed.decks.size} deck(s)\n\nGo to Decks tab to see them!`,
        [
          { 
            text: 'View Decks',
            onPress: () => {
              navigation.navigate('Decks' as never);
            }
          },
          {
            text: 'OK',
          }
        ]
      );

    } catch (error) {
      console.error('[Settings] Import error:', error);
      Alert.alert('Import Failed', error instanceof Error ? error.message : 'Unknown error');
      setImporting(false);
      setProgress('');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]} edges={['top']}>
      <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
        Settings
      </Text>

      {/* Import Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
          Import Deck
        </Text>
        <Text style={[styles.sectionDesc, { color: theme.colors.textSecondary }]}>
          Import any Anki deck (.apkg file) from your device. Supports all card types, media, and scheduling data.
        </Text>

        <Pressable
          style={[
            styles.importButton,
            { backgroundColor: theme.colors.accent },
            importing && styles.importButtonDisabled,
          ]}
          onPress={handleImportDeck}
          disabled={importing}
        >
          {importing ? (
            <View style={styles.importingContainer}>
              <ActivityIndicator color="#FFFFFF" />
              <Text style={styles.importButtonText}>{progress}</Text>
            </View>
          ) : (
            <Text style={styles.importButtonText}>Import .apkg File</Text>
          )}
        </Pressable>
      </View>

      {/* Info Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
          About
        </Text>
        <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
          Anki-compatible spaced repetition app
        </Text>
        <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
          Version 1.0.0
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: s.lg,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: s.xl,
  },
  section: {
    marginBottom: s.xl,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: s.sm,
  },
  sectionDesc: {
    fontSize: 14,
    marginBottom: s.md,
    lineHeight: 20,
  },
  importButton: {
    paddingVertical: s.md,
    paddingHorizontal: s.lg,
    borderRadius: r.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  importButtonDisabled: {
    opacity: 0.6,
  },
  importButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  importingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.sm,
  },
  infoText: {
    fontSize: 14,
    marginBottom: s.xs,
  },
});
