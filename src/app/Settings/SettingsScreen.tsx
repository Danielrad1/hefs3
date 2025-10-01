import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert, ScrollView } from 'react-native';
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

  const themeOptions = [
    { value: 'system', label: 'System' },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
  ] as const;

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

  const handleClearDatabase = () => {
    Alert.alert(
      'Clear All Data',
      'This will delete ALL decks, cards, and progress. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Everything',
          style: 'destructive',
          onPress: async () => {
            try {
              await PersistenceService.clear();
              db.clear();
              reload();
              Alert.alert('Success', 'All data has been cleared. You can now import decks fresh.');
            } catch (error) {
              Alert.alert('Error', 'Failed to clear database');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
          Settings
        </Text>

        {/* Appearance Section */}
        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]}>
              Appearance
            </Text>
          </View>
          <Text style={[styles.cardDesc, { color: theme.colors.textSecondary }]}>
            Choose your preferred theme
          </Text>

          <View style={styles.themeOptions}>
            {themeOptions.map((option) => (
              <Pressable
                key={option.value}
                style={[
                  styles.themeOption,
                  {
                    backgroundColor: theme.themePreference === option.value 
                      ? theme.colors.accent 
                      : theme.colors.bg,
                    borderColor: theme.themePreference === option.value
                      ? theme.colors.accent
                      : theme.colors.border,
                  }
                ]}
                onPress={() => theme.setThemePreference(option.value)}
              >
                <Text style={[
                  styles.themeOptionText,
                  { 
                    color: theme.themePreference === option.value 
                      ? '#FFFFFF' 
                      : theme.colors.textPrimary 
                  }
                ]}>
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Import Section */}
        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]}>
              Import Deck
            </Text>
          </View>
          <Text style={[styles.cardDesc, { color: theme.colors.textSecondary }]}>
            Import any Anki deck (.apkg file) from your device.
          </Text>

          <Pressable
            style={[
              styles.button,
              { backgroundColor: theme.colors.accent },
              importing && styles.buttonDisabled,
            ]}
            onPress={handleImportDeck}
            disabled={importing}
          >
            {importing ? (
              <View style={styles.buttonContent}>
                <ActivityIndicator color="#000" />
                <Text style={[styles.buttonText, { color: '#000' }]}>{progress}</Text>
              </View>
            ) : (
              <Text style={[styles.buttonText, { color: '#000' }]}>Choose File</Text>
            )}
          </Pressable>
        </View>

        {/* Danger Zone */}
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.danger, borderWidth: 1 }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: theme.colors.danger }]}>
              Danger Zone
            </Text>
          </View>
          <Text style={[styles.cardDesc, { color: theme.colors.textSecondary }]}>
            Clear all data and start fresh. This action cannot be undone.
          </Text>

          <Pressable
            style={[styles.button, { backgroundColor: theme.colors.danger }]}
            onPress={handleClearDatabase}
          >
            <Text style={[styles.buttonText, { color: '#FFF' }]}>Clear All Data</Text>
          </Pressable>
        </View>

        {/* Info Section */}
        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]}>
              About
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>App</Text>
            <Text style={[styles.infoValue, { color: theme.colors.textPrimary }]}>Anki SRS</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>Version</Text>
            <Text style={[styles.infoValue, { color: theme.colors.textPrimary }]}>1.0.0</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: s.lg,
    gap: s.lg,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: s.md,
  },
  card: {
    padding: s.lg,
    borderRadius: r.lg,
    gap: s.md,
  },
  cardHeader: {
    marginBottom: s.xs,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  cardDesc: {
    fontSize: 14,
    lineHeight: 20,
  },
  button: {
    paddingVertical: s.md,
    paddingHorizontal: s.lg,
    borderRadius: r.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.sm,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: s.sm,
  },
  infoLabel: {
    fontSize: 14,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  themeOptions: {
    flexDirection: 'row',
    gap: s.sm,
  },
  themeOption: {
    flex: 1,
    paddingVertical: s.md,
    paddingHorizontal: s.sm,
    borderRadius: r.md,
    borderWidth: 2,
    alignItems: 'center',
  },
  themeOptionText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
