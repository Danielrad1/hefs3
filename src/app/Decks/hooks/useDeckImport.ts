import { useState } from 'react';
import { Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { ApkgParser } from '../../../services/anki/ApkgParser';
import { MediaService } from '../../../services/anki/MediaService';
import { db } from '../../../services/anki/InMemoryDb';
import { PersistenceService } from '../../../services/anki/PersistenceService';

export function useDeckImport(onComplete: () => void) {
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<string>('');

  const handleImportDeck = async () => {
    try {
      // Small delay to let any modal close animation complete before opening picker
      await new Promise(resolve => setTimeout(resolve, 300));

      // Let user pick an .apkg file
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/octet-stream', // .apkg files
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const file = result.assets[0];
      
      // Validate file extension
      if (!file.name.endsWith('.apkg')) {
        Alert.alert('Invalid File', 'Please select an Anki deck file (.apkg)');
        return;
      }

      // Now show progress modal after file is selected
      setImporting(true);
      setImportProgress('Reading file...');
      
      // Parse .apkg
      const parser = new ApkgParser();
      const parsed = await parser.parse(file.uri);

      setImportProgress('Loading into database...');
      
      // Import models from collection
      console.log('[DeckImport] Importing models...');
      if (parsed.col.models) {
        const modelsObj = typeof parsed.col.models === 'string' 
          ? JSON.parse(parsed.col.models) 
          : parsed.col.models;
        
        Object.values(modelsObj).forEach((model: any) => {
          console.log('[DeckImport] - Model:', model.name, '(id:', model.id + ')');
          db.addModel(model);
        });
      }

      // Import deck configs
      console.log('[DeckImport] Importing deck configs...');
      if (parsed.deckConfigs && parsed.deckConfigs.size > 0) {
        parsed.deckConfigs.forEach((config) => {
          console.log('[DeckImport] - Deck config:', config.name, '(id:', config.id + ')');
          db.addDeckConfig(config);
        });
      }

      // Import decks
      console.log('[DeckImport] Importing', parsed.decks.size, 'decks:');
      parsed.decks.forEach((deck) => {
        console.log('[DeckImport] - Deck:', deck.name, '(id:', deck.id + ')');
        db.addDeck(deck);
      });

      // Import notes
      console.log('[DeckImport] Importing', parsed.notes.length, 'notes');
      parsed.notes.forEach((note) => {
        db.addNote(note);
      });

      // Import cards
      console.log('[DeckImport] Importing', parsed.cards.length, 'cards');
      parsed.cards.forEach((card) => {
        db.addCard(card);
      });

      // Register media files in database
      console.log('[DeckImport] Registering', parsed.mediaFiles.size, 'media files in DB...');
      const mediaService = new MediaService(db);
      for (const [mediaId, filename] of parsed.mediaFiles.entries()) {
        try {
          const media = await mediaService.registerExistingMedia(filename);
          if (media && __DEV__) {
            console.log('[DeckImport] - Registered media:', filename);
          } else if (!media) {
            console.warn('[DeckImport] - Could not register media:', filename);
          }
        } catch (error) {
          console.error('[DeckImport] Error registering media:', filename, error);
        }
      }
      
      // Verify what's in the database after import
      const allDecks = db.getAllDecks();
      console.log('[DeckImport] After import, database has', allDecks.length, 'decks:');
      allDecks.forEach(d => {
        const deckCards = db.getCardsByDeck(d.id);
        console.log('[DeckImport] -', d.name, ':', deckCards.length, 'cards');
      });

      setImportProgress('Saving...');
      
      // Save database to persistent storage
      await PersistenceService.save(db);
      
      setImportProgress('Complete!');
      
      // Notify parent component
      onComplete();
      
      setImporting(false);
      setImportProgress('');
      
      Alert.alert(
        'Import Successful',
        `Imported ${parsed.cards.length} cards from ${parsed.decks.size} deck(s)`,
        [{ text: 'OK' }]
      );

    } catch (error) {
      console.error('[DeckImport] Import error:', error);
      Alert.alert('Import Failed', error instanceof Error ? error.message : 'Unknown error');
      setImporting(false);
      setImportProgress('');
    }
  };

  return {
    importing,
    importProgress,
    handleImportDeck,
  };
}
